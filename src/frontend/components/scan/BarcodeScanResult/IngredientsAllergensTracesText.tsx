import {Linking, StyleSheet, Text} from "react-native";
import React, {useEffect, useState} from "react";
import TranslatedText from "../../TranslatedText";
import {extractEnglishAllergens, translateIngredients } from "../../../utils";
import getAllergensFromText from "../../../ocr-postprocessing";
import { useAppSelector } from "../../../hooks";
import {useIsFocused} from "@react-navigation/native";

function IngredientsAllergensTracesText({scan, setSafetyResult}) {
    const isFocused = useIsFocused();
    const account = useAppSelector(state => state.appData.accounts[state.user.username]);
    const [translatedAllergensText, setTranslatedAllergensText] = useState("translating..");
    const [translatedTracesText, setTranslatedTracesText] = useState("translating..");
    const [translatedIngredientsText, setTranslatedIngredientsText] = useState("translating..");
    const [alreadyTranslated, setAlreadyTranslated] = useState(false);

    const translate = async () => {
        let res;
        let completeText = ""; // to help determine and clarify safety of a product to the user using SafetyResult
        if ((translatedAllergensText === "translating.." || alreadyTranslated) && scan) {
            res = await translateIngredientText();
            completeText += " " + res;
            setAlreadyTranslated(true);

            setTranslatedIngredientsText(res);
        }
        if ((translatedAllergensText === "translating.." || alreadyTranslated) && scan) {
            res = await translateAllergens(scan?.allergens);
            completeText += " " + res;
            setAlreadyTranslated(true);

            setTranslatedAllergensText(res);
        }
        if ((translatedAllergensText === "translating.." || alreadyTranslated) && scan) {
            res = await translateAllergens(scan?.traces_tags)
            completeText += " " + res;
            setAlreadyTranslated(true);

            setTranslatedTracesText(res);
        }

        return completeText;
    }

    const translateIngredientText = async () => {
        if (translatedIngredientsText === "translating.." || alreadyTranslated){
            return `${await translateIngredients(scan?.ingredients_text)}`;
        }
    }

    const translateAllergens = async (allergenList: Array<string>) => {
        return `${await extractEnglishAllergens(allergenList)}`;
    };

    useEffect(() => {
        translate().then((res) => {
            setSafetyResult(getAllergensFromText(res, account)); 
        })
    }, [scan])

    return (
        <>
            {(!scan?.ingredients_complete_boolean) && (!scan?.ingredients_text)
                ?
                <Text style={styles.notFoundText}>
                    Ingredients not available.{"\n"}{"\n"}
                    <Text style={{fontWeight: "bold"}}>Allergen information unavailable</Text>{"\n"}{"\n"}
                    <Text style={{color: "blue", textDecorationLine: "underline"}}
                        onPress={() => Linking.openURL(`https://world.openfoodfacts.org/cgi/product.pl?type=edit&code=${scan?.product_code}`)}
                    >
                    Click here
                </Text> to update the product information via Open Food Facts to inform future scanners.</Text>
                :
                <TranslatedText title={"Ingredients"} originalText={scan?.ingredients_text} translatedText={translatedIngredientsText}/>
            }

            {scan?.allergens == ""
                ?
                <Text></Text>
                :
                <TranslatedText title={"Allergens"} originalText={scan?.allergens} translatedText={translatedAllergensText}/>
            }
            {translatedTracesText !== "" &&
                <TranslatedText title={"May contain traces of"} originalText={scan?.traces_tags} translatedText={translatedTracesText}/>
            }
            {scan?.ingredients_text && scan?.traces_tags == "" && scan?.allergens == "" &&
                <Text style={{fontWeight: "bold"}}>No allergens detected</Text>
            }
        </>
    )
}

const styles = StyleSheet.create({
    notFoundText: {
        alignSelf: "flex-start",
        paddingBottom: 20
    }
})

export default IngredientsAllergensTracesText;