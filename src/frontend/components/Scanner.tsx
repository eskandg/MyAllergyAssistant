import React, {useEffect, useRef, useState} from 'react';
import {StyleSheet, Text, TouchableOpacity, View, Image, FlatList} from 'react-native';
import {
  Camera,
  useCameraDevices, useFrameProcessor
} from 'react-native-vision-camera';
import {BarcodeFormat, scanBarcodes} from 'vision-camera-code-scanner';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import AppModal from "./AppModal";
import {ocrPreprocessing, scanBarcode, updateUser, getInitialNotificationState} from '../api';
import ScanResult from '../screens/scan/ScanResult';
import { useAppDispatch, useAppSelector } from '../hooks';
import { updateScans } from '../reducers/app-data-reducer';
import FontAwesome5 from "react-native-vector-icons/FontAwesome5";
import {launchImageLibrary} from "react-native-image-picker";
import BarcodeScanning from '@react-native-ml-kit/barcode-scanning';
import { scanOCR } from 'vision-camera-ocr';
import TextRecognition from '@react-native-ml-kit/text-recognition';
import { runOnJS } from 'react-native-reanimated';
import ImagePicker from 'react-native-image-crop-picker';
import {readFile, TemporaryDirectoryPath, writeFile} from "react-native-fs";
import {updateLoadingState, updateScanMode} from '../reducers/ui-reducer';
import FontAwesome5Icon from "react-native-vector-icons/FontAwesome5";
import {Image as compressor} from "react-native-compressor";
// 
export enum ScanMode {
  Text = 'TEXT',
  Barcode = 'BARCODE',
  Detect = 'DETECT'
}

interface ScannerProps {
  barcodeText: string,
  setBarcodeText: object
}

export const storeScan = (barcodeText, scan, scans, dispatch, user) => {

    console.log(barcodeText)
    let scanObj = {[barcodeText]: {product_display_name: scan.product_display_name, date: scan.date, receive_notifications: getInitialNotificationState(barcodeText, scans)}};
    console.log("\nscanObj -> " + JSON.stringify(scanObj));

    updateUser({username: user.username, deviceEndpoint: user.deviceEndpoint, email: user.email, scan: scanObj});

    // add to redux scans
    dispatch(updateScans({username: user.username, scan: {...scanObj}}));
    console.log("\nScanner scan:", scan);
}

function Scanner({barcodeText, setBarcodeText}: ScannerProps) {
  const dispatch = useAppDispatch();
  const user = useAppSelector(state => state.user);
  const scans = useAppSelector(state => state.appData.accounts[user.username]?.scans);
  const scanMode = useAppSelector(state => state.ui.scanMode);
  const navigation = useNavigation(); // 
  const Stack = createNativeStackNavigator();
  const devices = useCameraDevices();
  const device = devices.back;
  const camera = useRef<Camera>(null);
  const isFocused = useIsFocused();
  const [lastBarcodeSeen, setLastBarcodeSeen] = useState<string | null>(null);
  const [isBarcodeModalOpen, setIsBarcodeModalOpen] = useState<boolean>(false);
  const [isOcrModalOpen, setIsOcrModalOpen] = useState<boolean>(false);
  const [isProductNotFoundModalOpen, setIsProductNotFoundModalOpen] = useState<boolean>(false);
  const [photo, setPhoto] = useState<string>("");
  const [editPhoto, setEditPhoto] = useState<string>("");
  const [barcodes, setBarcodes] = useState([]);
  const [ocrResult, setOcrResult] = useState({});
  const [ingredientsFound, setIngredientsFound] = useState(false);
  const [isDetected, setIsDetected] = useState(false);
  const [modeStyle, setModeStyle] = useState<object>({color: "", icon: ""});

  const foodBarcodeFormats = [BarcodeFormat.EAN_13, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E, BarcodeFormat.EAN_8]

  const frameProcessor = useFrameProcessor((frame) => {
    'worklet';

    const barcodesDetected = scanBarcodes(frame, foodBarcodeFormats, {checkInverted: true});
    const ocrScan = scanOCR(frame);

    runOnJS(setOcrResult)(ocrScan);
    runOnJS(setBarcodes)(barcodesDetected);
  }, []);

  const changeScanModeHandler = () => {
    const scanModes = [ScanMode.Barcode, ScanMode.Detect, ScanMode.Text];
    let nextMode: ScanMode = scanModes[(scanModes.indexOf(scanMode) + 1) % scanModes.length];
    dispatch(updateScanMode(nextMode));
    setIsDetected(false);
    setIngredientsFound(false);
    setBarcodes([]);
    setOcrResult({});
    setBarcodeText("");
    setLastBarcodeSeen("");
  };

  const takePhotoHandler = async () => {
    return await camera.current.takePhoto({
      enableAutoStabilization: true,
    });
  };

  const openCameraRoll = () => {
    let options = {title: 'Select an image'}

    launchImageLibrary(options, (image) => {
      if (!image.didCancel) {
        setPhoto(image.assets[0].uri); // 
      
        // scan barcode from image
        BarcodeScanning.scan(image.assets[0].uri).then(async (res) => {
          if (res.length > 0) {
            console.log("res: ", res);
            console.log(res, res[0]?.value, lastBarcodeSeen);
            setBarcodeText(res[0]?.value ?? lastBarcodeSeen);
            setIsBarcodeModalOpen(true);
          } else {
            // scan ingredients text from image
            setIngredientsFound(true);
            setIsOcrModalOpen(true);
          }
        });
      }
    });
  }

  const OCR = async (photo, isFromCameraRoll: boolean) => {

        // prepare image for OCR
        dispatch(updateLoadingState());
        navigation.navigate("Loading", {text: "Scanning..."});

        // compress for AWS Lambda 6mb request limit
        // const compressed = await compressor.compress(photo, {quality: 0.5});
        const compressed = photo;
        let photoBase64 = await readFile(compressed, "base64");
        photoBase64 = await ocrPreprocessing(photoBase64);
        const ocrImage = `data:image/jpeg;base64,${photoBase64}`;
        setEditPhoto(ocrImage);
        await writeFile(`${TemporaryDirectoryPath}/img.jpg`, photoBase64, "base64");

        const text = await TextRecognition.recognize(`file:///${TemporaryDirectoryPath}/img.jpg`);

        if (!isFromCameraRoll) {
          setIngredientsFound(false);
          setIsOcrModalOpen(false);
        }

        dispatch(updateLoadingState());
        navigation.navigate("ScanResult", { scan: {ocrResult: text, ocrImage: photo, ocrImageOutput: ocrImage} });
  }

  useEffect(() => {
    switch (scanMode) {
      case ScanMode.Barcode:
        setModeStyle({color: "red", icon: "barcode"});
        break;
      case ScanMode.Detect:
        setModeStyle({color: "#F7CC3B", icon: "binoculars"});
        break;
      case ScanMode.Text:
        setModeStyle({color: "#6200EE", icon: "list"});
        break;
    }
  }, [scanMode]);

  useEffect(() => {
    const barcodeCondition = scanMode === ScanMode.Barcode || scanMode === ScanMode.Detect;
    const ocrCondition = scanMode === ScanMode.Text || scanMode === ScanMode.Detect;

    if (ocrCondition && ocrResult?.result?.blocks?.length > 0) {
      if (ocrResult.result?.text != "" && ocrResult.result?.text.toLowerCase().includes("ingredients")) {
        setIsDetected(true)
        if (!ingredientsFound) {
          takePhotoHandler().then((photo) => {
            setPhoto("file://" + photo.path)
          }).then(() => {
            setIngredientsFound(true);
          });
        }
      }
      else {
        setIngredientsFound(false);
      }
    }
    else if (barcodeCondition && barcodes.length > 0) {
      setIsDetected(true);
      setLastBarcodeSeen(barcodes[0].displayValue);
    }
    else {
      setIsDetected(false);
    }

  }, [ocrResult, barcodes]);

  return (
    <View style={{flex: 1}}>
       {device !== undefined && (
        <>
             <Stack.Navigator>
               <Stack.Screen name="ScanResult" >
                 {(props) => (
                     <ScanResult {...props} />
                 )}
               </Stack.Screen>
             </Stack.Navigator>

           <Camera
             ref={camera}
             frameProcessor={frameProcessor}
             frameProcessorFps={5}
             photo={true}
             device={device}
             isActive={!isOcrModalOpen && !isBarcodeModalOpen && isFocused}
             style={StyleSheet.absoluteFill}
             enableZoomGesture
           />

           <AppModal
               isModalOpen={{state: isBarcodeModalOpen, setState: (bool: boolean) => {setIsBarcodeModalOpen(bool)}}}
               headerText={"Scan barcode"}
               modalContentText={"Would you like to scan this product?"}
               modalBtnsConfig={{
                   option1: {
                       onPress: async () => {
                           console.log("Yes pressed. product:", barcodeText);
                           dispatch(updateLoadingState());
                           navigation.navigate("Loading", {text: "Scanning..."});
                           let scan = await scanBarcode(barcodeText);

                           // if product found then store scan
                           if (scan.status == "product found") {
                             // store scan in dynamoDB table
                             storeScan(barcodeText, scan, scans, dispatch, user);

                             dispatch(updateLoadingState());
                             navigation.navigate("ScanResult", { scan: scan });
                           } else {
                             //product not found in OFF database
                            // display error modal

                            dispatch(updateLoadingState());
                            setIsProductNotFoundModalOpen(true);
                           }

                           setBarcodeText("");
                           setLastBarcodeSeen("");
                       },
                       text: "Yes"
                   },
                   option2: {
                       onPress: () => {
                           console.log("No pressed.");
                           console.log(barcodes, barcodeText)
                           setBarcodeText("");
                           setLastBarcodeSeen("")
                       },
                       text: "No",
                   }
               }}
          />

          <AppModal
               isModalOpen={{state: isOcrModalOpen, setState: (bool: boolean) => {setIsOcrModalOpen(bool)}}}
               headerText={"Scan Ingredients"}
               modalContent={
                  <>
                    <Image style={{height: 200, width: 200}} source={{uri: photo}} />
                    <TouchableOpacity
                        activeOpacity={0.5}
                        style={styles.crop}
                        onPress={() => {
                          ImagePicker.openCropper({
                            path: photo,
                            freeStyleCropEnabled: true,
                            enableRotationGesture: true,
                          }).then(image => {
                            setPhoto(image.path);
                          });
                        }}
                    >
                      <Text>Crop</Text>
                    </TouchableOpacity>
                  </>
               }
               modalContentText={"Would you like to scan this product's ingredients?"}
               modalBtnsConfig={{
                   option1: {
                       onPress: async () => {
                          console.log("yes pressed.");
                          OCR(photo, false);
                       },
                       text: "Yes"
                   },
                   option2: {
                       onPress: () => {
                          setOcrResult({});
                          setIngredientsFound(false);
                       },
                       text: "No",
                   }
               }}
           />

            <AppModal
               isModalOpen={{state: isProductNotFoundModalOpen, setState: (bool: boolean) => {setIsProductNotFoundModalOpen(bool)}}}
               headerText={"Product NOT FOUND :("}
               modalContentText={"Barcode '" + barcodeText + "' not found in product database.\nTry scan ingredients instead"}
               modalBtnsConfig={{
                   option1: {
                       onPress: async () => {
                        setBarcodeText("");
                        console.log();
                       },
                       text: "Continue"
                   }
               }}
          />

           <View style={styles.bottomButtonsContainer}>
             <View style={{flex: 1, justifyContent: "center", alignItems: "center"}}>

               <FontAwesome5.Button backgroundColor={"rgba(0,0,0,0)"} color={"white"} name={"images"} size={50} onPress={
                 () => {
                   console.log("select image from camera roll.");
                   openCameraRoll();
                 }
               }/>
             </View>

             <View style={{flex: 1, justifyContent: "center", alignItems: "center"}}>
               <TouchableOpacity
                 onPress={() => {
                   if (isDetected) {
                     if (ingredientsFound) {
                        setIsOcrModalOpen(true);
                     }
                     else {
                        setIsBarcodeModalOpen(true);

                        // there is a chance that the current barcode may be lost in real-time, then lastBarcodeSeen is taken
                        setBarcodeText(barcodes[0]?.displayValue || lastBarcodeSeen);
                     }
                   }
                 }}
               >
                 <FontAwesome5Icon color={isDetected ? "red" : "white"} name={isDetected ? "dot-circle" : "circle"} backgroundColor={"rgba(0,0,0,0)"} size={70}/>
               </TouchableOpacity>

             </View>
             <View style={{flex: 1, justifyContent: "center", alignItems: "center"}}>
               <TouchableOpacity onPress={changeScanModeHandler} style={{justifyContent: "center", alignItems: "center", alignContent: "center"}}>
                  <FontAwesome5Icon
                      color="white"
                      style={{...styles.modeButton, backgroundColor: modeStyle.color, borderColor: isDetected ? "#39ff14" : "orange"}}
                      name={modeStyle.icon}
                      size={25}
                  />
               </TouchableOpacity>
             </View>
           </View>
         </>
       )}
     </View>
  );
}

const styles = StyleSheet.create({
  bottomButtonsContainer: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "center",
    marginBottom: 5 
  },
  crop: {
    backgroundColor: "ghostwhite",
    borderColor: "lightgrey",
    borderWidth: 0.2,
    padding: 5,
    alignItems: "center",
    justifyContent: "center"
  },
  photoButton: {
    paddingBottom: "6%",
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 200,
    borderColor: '#000',
    borderWidth: 1,
  },
  modeButton: {
    width: "100%",
    textAlign: "center",
    justifyContent: "center",
    alignItems: "center",
    padding: 15,
    borderRadius: 10,
    borderWidth: 3,
  }
});

export default Scanner;
