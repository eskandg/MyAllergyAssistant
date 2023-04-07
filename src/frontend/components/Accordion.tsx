import {Dimensions, Text, TouchableOpacity, View} from "react-native";
import FontAwesome5 from "react-native-vector-icons/FontAwesome5";
import Collapsible from "react-native-collapsible";

interface AccordionProps {
    style?: object,
    headerStyle?: object,
    headerTextStyle?: object,
    contentStyle?: object,
    headerText: string,
    content: any,
    collapsed: boolean,
    setCollapsed: Function
}

function Accordion({style = {}, headerStyle = {}, headerTextStyle = {}, contentStyle = {}, headerText, content, collapsed, setCollapsed}: AccordionProps) {
    const {height, width} = Dimensions.get("window");
    return (
        <View style={style}>
            <View style={{backgroundColor: "white", width: "auto", paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: "#a1a1a1", ...headerStyle}}>
                <TouchableOpacity onPress={() => {setCollapsed(!collapsed)}}>
                    <View style={{flexDirection: "row"}}>
                        <FontAwesome5 style={{marginTop: 5, marginRight: 15}} name={collapsed ? "chevron-down" : "chevron-up"} size={25}/>
                        <Text style={headerTextStyle}>{headerText}</Text>
                    </View>
                </TouchableOpacity>
            </View>

            <Collapsible collapsed={collapsed} style={{height: height * 0.5, backgroundColor: "ghostwhite", padding: 20, borderWidth: 0.5, borderBottomLeftRadius: 5, borderBottomRightRadius: 5, borderTopWidth: 0, ...contentStyle}}>
                {content}
            </Collapsible>
        </View>
    )
}

export default Accordion;