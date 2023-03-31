import React, {useEffect, useRef, useState} from "react";
import {Dimensions, ScrollView, Text, StyleSheet, View, Image, Button, TouchableOpacity, Modal, Linking} from "react-native";
import {useAppSelector, useAppDispatch} from "../hooks";
import ALLERGENS from "../allergens.json";
import SwitchSelector from "react-native-switch-selector";
import FontAwesome5 from 'react-native-vector-icons/FontAwesome5';
import AppModal from "./AppModal";
import { MultipleSelectList } from 'react-native-dropdown-select-list';
import { translateIngredients, extractEnglishAllergens, Report, addReportToDynamo, updateUser, getInitialNotificationState, addNotificationsToDynamo, deleteNotificationsFromDynamo, UpdatableNotificationObj } from "../api";
import {updateProductNotificationStatus} from "../reducers/app-data-reducer";

function BarcodeScanResult(scan: object) {
    const {height, width} = Dimensions.get("window");
    const dispatch = useAppDispatch();
    const username = useAppSelector(state => state.user.username);
    const email = useAppSelector(state => state.user.email);
    const usersScanHistory = useAppSelector(state => state.appData.accounts[username]?.scans);
    const deviceEndpoint = useAppSelector(state => state.user.deviceEndpoint); // 
    const user = useAppSelector(state => state.appData.accounts[username]);
    const scans = useAppSelector(state => state.appData.accounts[username]?.scans);
    const [isReportModalOpen, setIsReportModalOpen] = useState<boolean>(false);
    const [selectedList, setSelectedList] = useState([]);
    const [viewReportWarning, setViewReportWarning] = useState<boolean>(true);
    const [translatedAllergensText, setTranslatedAllergensText] = useState("translating..");
    const [translatedTracesText, setTranslatedTracesText] = useState("translating..");
    const [translatedIngredientsText, setTranslatedIngredientsText] = useState("translating..");
    scan = scan?.scan;

    const translateIngredientText = async () => {
        if (translatedIngredientsText === "translating.."){
            console.log("[1] translated ingredients.");
            return `${await translateIngredients(scan?.ingredients_text)}`;
        }
    }
    useEffect(() => {
        if (translatedIngredientsText === "translating.." && scan){
            translateIngredientText().then((res)=> {
                setTranslatedIngredientsText(res);
            })
        }
        if (translatedAllergensText === "translating.." && scan){
            translateAllergens(scan?.allergens).then((res)=> {
                console.log("[2] translated allergens: ", res);
                setTranslatedAllergensText(res);
            })
        }
        if (translatedTracesText === "translating.." && scan){
            translateAllergens(scan?.traces_tags).then((res) => {
                console.log("[3] translated traces: ", res);
                setTranslatedTracesText(res);
            })
        }
    }, [])

    const translateAllergens = async (allergenList: Array<string>) => {
        // let allergenList = scan?.allergens.split(",");
        // let joinedAllergenList = allergenList?.concat(scan?.allergens_from_ingredients.split(","));
        // if translatedAllergens
        return `${await extractEnglishAllergens(allergenList)}`;
    };

    // translateAllergens
        // AuthToken().then((res) => {
        //     console.log(res);
        // });
    
    // useEffect(() => {
    //     if (scans != undefined){
    //         translateAllergens().then((res) => {
    //             if (scan!= undefined){
    //                 scan.allergens = res;
    //                 console.log("updated allergens to: "+ res);
    //             }
    //         })
    //     }
    // }, [scans]);
    useEffect(() => {
        // setSelectedList(user?.allergens);
        console.log("test a")
    }, [user?.allergens])

    useEffect(() => {
        console.log(selectedList)
    }, [selectedList])

    return (
        <>
            <Text style={{fontSize: 30, fontWeight: 'bold', margin:'3.5%', flexWrap: "wrap", textAlign: 'center'}}>
                {scan?.product_display_name}
            </Text>

            <View style={{display:"flex", marginLeft: 20}}>
                {(!scan?.ingredients_complete_boolean) && (!scan?.ingredients_text)
                    ?
                    <Text style={{alignSelf: "flex-start", paddingBottom: 20}}>
                        Ingredients not available.{"\n"}{"\n"}
                        Allergen information unavailable{"\n"}{"\n"}
                        <Text style={{color: "blue", textDecorationLine: "underline"}}
                            onPress={() => Linking.openURL(`https://world.openfoodfacts.org/cgi/product.pl?type=edit&code=${scan?.product_code}`)}
                        >
                        Click here
                    </Text> to update the product information via Open Food Facts to inform future scanners.</Text>
                    :
                    <Text style={{alignSelf: "flex-start", paddingBottom: 20}}><Text style={{fontWeight: "bold"}}>Ingredients:</Text>  {translatedIngredientsText}</Text>
                }

                {scan?.allergens == ""
                    ?
                    <Text></Text>
                    :
                    <Text><Text style={{fontWeight: "bold"}}>Allergens:</Text>  {translatedAllergensText}</Text>
                }
                {scan?.traces_tags == ""
                    ?
                    <Text></Text>
                    :
                    <Text><Text style={{fontWeight: "bold"}}>May contain traces of:</Text>  {translatedTracesText}</Text>
                }
                {scan?.traces_tags == "" && scan?.allergens == "" &&
                    <Text style={{fontWeight: "bold"}}>No allergens detected</Text>
                }


                <View>
                    <Text style={{paddingTop: 20, paddingBottom: 10}}>Receive notifications if product is reported?</Text>
                    <SwitchSelector
                        initial={getInitialNotificationState(scan?.product_code, usersScanHistory) ? 0 : 1}
                        onPress={(val) => {
                            let bool = (val==0);
                            console.log("set product "+scan?.product_code+" notification_status to " + bool);

                            let notifyObj : UpdatableNotificationObj = {productId: scan?.product_code, user_endpoint: deviceEndpoint}
                            //
                            //
                            if (bool) {
                                // add user_endpoint to notifications table in DynamoDB
                                addNotificationsToDynamo(notifyObj);
                            } else {
                                // remove user_endpoint from notifications table in DynamoDB
                                deleteNotificationsFromDynamo(notifyObj);
                            }
                            updateUser({username: username, deviceEndpoint: deviceEndpoint, email: email, product_id: scan?.product_code, receive_notifications: bool})
                            dispatch(updateProductNotificationStatus({username: username, product_id: scan?.product_code, product_notifications_boolean: bool}))
                        }}
                        options={[
                            {label: " ON", customIcon: <FontAwesome5 name={"bell"} size={25}/>, value: 0},
                            {label: " OFF", customIcon: <FontAwesome5 name={"bell-slash"} size={25}/>, value: 1}
                        ]}
                        // height={40}
                        style={{width:"75%"}}
                        buttonMargin={2}
                        hasPadding
                    />
                </View>
                <View style={{flexDirection: "column", marginVertical: 25}}>
                    <Text style={{maxWidth: "75%"}}>Missing allergens? {"\n"}Issue a report and let others know.</Text>
                    <TouchableOpacity
                        style={{ maxWidth: "50%", marginTop: 10, padding: 10, justifyContent: "center", alignItems:"center", backgroundColor: "red", borderRadius: 10, borderWidth: 0.5, flexDirection: "row"}}
                        onPress={() => {
                            console.log("open report modal.");
                            setIsReportModalOpen(true);
                        }}
                    >
                        <FontAwesome5 color={"white"} name={"flag-checkered"} size={25}/>
                        <Text style={{color: "white", paddingLeft: 20}}>Report product</Text>
                    </TouchableOpacity>
                </View>
           </View>

            {/*
                DynamoDB tables: User table, Report table, Notifications table

                - when user scans a product, update user scans attribute, before loading product page, check reports table for that product
                - when user reports a product, post/update report to report table, when response received, get all users who have notifications turned on for that product
                - when a user turns notifications for product X on, update user scans table, and update notifications table

            */}

            <AppModal
                isModalOpen={{state: isReportModalOpen, setState: (bool: boolean) => {setIsReportModalOpen(bool)}}}
                headerText={"Are you sure you want to report this product?"}
                modalContent={
                    <>
                        {viewReportWarning ?
                            <>
                                <Text>
                                    Only report products if it caused you to have an allergic reaction, and you have
                                    consulted with a doctor to ensure you're not allergic to any of the listed
                                    ingredients. {"\n\n"}This will notify all users who previously scanned this product's
                                    barcode. {"\n\n"}A warning will also be displayed on the product page to warn future
                                    scanners. {"\n\n"}If you are certain what caused your allergic reaction, please select
                                    the allergen(s) from the dropdown list:
                                </Text>
                                <TouchableOpacity style={{backgroundColor: "red", borderRadius: 50, padding: 10, marginVertical: 20, justifyContent: "center", alignItems: "center"}} onPress={() => {setViewReportWarning(false)}}>
                                    <Text style={{color: "white"}}>Specify Allergens</Text>
                                </TouchableOpacity>
                            </>
                            :
                            <TouchableOpacity style={{marginBottom: 10, alignItems: "center"}} onPress={() => {setViewReportWarning(true)}}>
                                <Text style={{fontWeight: "300", fontSize: 25, color: "grey", textDecorationLine: "underline"}}>Go Back...</Text>
                            </TouchableOpacity>
                        }
                            <View style={{flex: viewReportWarning ? 0 : 1, minWidth: "100%"}} onTouchStart={() => {setViewReportWarning(false)}}>
                                {!viewReportWarning &&
                                    <ScrollView>
                                        <MultipleSelectList
                                            style={{flex: 1}}
                                            label={'Allergens Chosen'}
                                            selected={selectedList}
                                            setSelected={(value) => setSelectedList(value)}
                                            data={user?.allergens}
                                            save="value"
                                            placeholder={"Reported Allergens"}
                                        />
                                    </ScrollView>
                                }
                        </View>
                        </>
                }
                modalBtnsConfig={viewReportWarning && {
                    option1: {
                        onPress: () => {
                            console.log("report cancelled.")
                        },
                        text: "No - Cancel",
                    },
                    option2: {
                        onPress: () => {
                            let reportObj : Report = {username: username, productName: scan?.product_display_name, productId: scan?.product_code, suspectedAllergens: selectedList}
                            addReportToDynamo(reportObj);
                            // let reportObj2 : Report = {productId: scan?.product_code}
                            // let reportsResponse = await getProductReports(reportObj2);
                            // console.log(reportsResponse);
                            console.log("sending report for product " + scan?.product_code +  " with allergens {" +selectedList + "} to dynamo");
                            setSelectedList([]);
                        },
                        text: "Yes - Report Product",
                    }
                }}

            />
        </>
    )
}

export default BarcodeScanResult;