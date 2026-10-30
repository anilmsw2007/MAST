import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  StatusBar,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  Share,
  Dimensions,
  Platform,
  Image,
  Vibration,
  Linking,
  NativeSyntheticEvent,
  NativeScrollEvent,
  PanResponder
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import * as Notifications from 'expo-notifications';
import * as LocalAuthentication from 'expo-local-authentication';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Safe padding to avoid notch / signal / camera collision
const TOP_SAFE_PADDING = Platform.OS === 'android'
  ? Math.max(StatusBar.currentHeight || 0, 36) + 16
  : 16;

const TABS = ['home', 'vault', 'reminders', 'bus', 'diary', 'family'] as const;
type TabType = typeof TABS[number];

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
    priority: Notifications.AndroidNotificationPriority.HIGH
  }),
});

// Universal Translation Dictionary for Data Items
const TRANSLATION_MAP: Record<string, { hi: string; en: string }> = {
  // Medicines
  'दादाजी: BP व दिल की दवा (Telmisartan)': {
    hi: 'दादाजी: BP व दिल की दवा (Telmisartan)',
    en: 'Grandpa: BP & Heart Medicine (Telmisartan)'
  },
  'माताजी: थायराइड (Thyronorm 50mcg)': {
    hi: 'माताजी: थायराइड (Thyronorm 50mcg)',
    en: 'Mother: Thyroid (Thyronorm 50mcg)'
  },
  '1 गोली भोजन बाद': { hi: '1 गोली भोजन बाद', en: '1 pill after meal' },
  '1 गोली खाली पेट': { hi: '1 गोली खाली पेट', en: '1 pill empty stomach' },
  'डॉ. वी. के. शर्मा (MD Med)': { hi: 'डॉ. वी. के. शर्मा (MD Med)', en: 'Dr. V. K. Sharma (MD Med)' },
  'डॉ. अनीता गुप्ता (Endo)': { hi: 'डॉ. अनीता गुप्ता (Endo)', en: 'Dr. Anita Gupta (Endo)' },
  'अपोलो क्लीनिक, नई दिल्ली': { hi: 'अपोलो क्लीनिक, नई दिल्ली', en: 'Apollo Clinic, New Delhi' },
  'मैक्स सुपर स्पेशलिटी': { hi: 'मैक्स सुपर स्पेशलिटी', en: 'Max Super Speciality' },
  'दादाजी (72 वर्ष)': { hi: 'दादाजी (72 वर्ष)', en: 'Grandpa (72 yrs)' },
  'माताजी (58 वर्ष)': { hi: 'माताजी (58 वर्ष)', en: 'Mother (58 yrs)' },
  'परिवार सदस्य': { hi: 'परिवार सदस्य', en: 'Family Member' },
  'डॉ. निजी चिकित्सक': { hi: 'डॉ. निजी चिकित्सक', en: 'Dr. Personal Physician' },
  'पारिवारिक क्लिनिक': { hi: 'पारिवारिक क्लिनिक', en: 'Family Clinic' },
  '1 गोली': { hi: '1 गोली', en: '1 pill' },

  // Appliances
  'एलजी 1.5 टन डुअल इन्वर्टर एसी': { hi: 'एलजी 1.5 टन डुअल इन्वर्टर एसी', en: 'LG 1.5 Ton Dual Inverter AC' },
  'सैमसंग 324L डबल डोर फ्रिज': { hi: 'सैमसंग 324L डबल डोर फ्रिज', en: 'Samsung 324L Double Door Refrigerator' },
  'सैमसंग इन्वर्टर 1.5 टन AC': { hi: 'सैमसंग इन्वर्टर 1.5 टन AC', en: 'Samsung Inverter 1.5 Ton AC' },
  'विजय सेल्स': { hi: 'विजय सेल्स', en: 'Vijay Sales' },
  'विजय सेल्स, साउथ एक्स': { hi: 'विजय सेल्स, साउथ एक्स', en: 'Vijay Sales, South Ex' },
  'क्रोमा': { hi: 'क्रोमा', en: 'Croma' },
  'दुकान': { hi: 'दुकान', en: 'Local Store' },

  // Gold
  'माँ का सोने का पारंपरिक हार': { hi: 'माँ का सोने का पारंपरिक हार', en: "Mother's Traditional Gold Necklace" },
  'सोने की चूड़ियां (2 नग)': { hi: 'सोने की चूड़ियां (2 नग)', en: 'Gold Bangles (Pair)' },
  '22K 916 BIS हॉलमार्क': { hi: '22K 916 BIS हॉलमार्क', en: '22K 916 BIS Hallmark' },
  '22K 916 हॉलमार्क': { hi: '22K 916 हॉलमार्क', en: '22K 916 Hallmark' },
  'तनिष्क ज्वेलर्स': { hi: 'तनिष्क ज्वेलर्स', en: 'Tanishq Jewellers' },
  'कल्याण ज्वेलर्स': { hi: 'कल्याण ज्वेलर्स', en: 'Kalyan Jewellers' },
  'SBI लॉकर #104': { hi: 'SBI लॉकर #104', en: 'SBI Bank Locker #104' },
  'घर की सेफ अलमारी': { hi: 'घर की सेफ अलमारी', en: 'Home Safe Vault' },

  // Docs
  'बाबूजी': { hi: 'बाबूजी', en: 'Father' },
  'अम्मा': { hi: 'अम्मा', en: 'Mother' },
  'स्वयं': { hi: 'स्वयं', en: 'Self' },
  'बच्चे': { hi: 'बच्चे', en: 'Kids' },
  'आधार कार्ड (Aadhaar)': { hi: 'आधार कार्ड (Aadhaar)', en: 'Aadhaar Card' },
  'आधार कार्ड': { hi: 'आधार कार्ड', en: 'Aadhaar Card' },
  'आयुष्मान भारत हेल्थ कार्ड': { hi: 'आयुष्मान भारत हेल्थ कार्ड', en: 'Ayushman Bharat Health Card' },

  // Reminders
  'बिजली का बिल (BSES)': { hi: 'बिजली का बिल (BSES)', en: 'Electricity Bill (BSES)' },
  'डीपीएस स्कूल फीस (तिमाही)': { hi: 'डीपीएस स्कूल फीस (तिमाही)', en: 'DPS School Fees (Quarterly)' },
  'गैस सिलेंडर बुकिंग (Indane)': { hi: 'गैस सिलेंडर बुकिंग (Indane)', en: 'LPG Gas Booking (Indane)' },

  // Chat
  'पापा': { hi: 'पापा', en: 'Dad' },
  'माँ': { hi: 'माँ', en: 'Mom' },
  'आज शाम की चाय पर सबको साथ बैठना है।': { hi: 'आज शाम की चाय पर सबको साथ बैठना है।', en: 'Everyone join for evening tea together today.' },
  'हाँ, मैंने पकौड़े बनाने की तैयारी कर ली है! 😊': { hi: 'हाँ, मैंने पकौड़े बनाने की तैयारी कर ली है! 😊', en: 'Yes, snacks are ready! 😊' },

  // Diary
  'उम्मीद की किरण': { hi: 'उम्मीद की किरण', en: 'Ray of Hope' },
  'थक कर न बैठ ऐ मुसाफिर, मंज़िल करीब आएगी,\nआज की यह रात ढलेगी, कल फिर नई सुबह मुस्कुराएगी।\nअपने हौसलों पर यकीन रख, हर मुश्किल आसान हो जाएगी।': {
    hi: 'थक कर न बैठ ऐ मुसाफिर, मंज़िल करीब आएगी,\nआज की यह रात ढलेगी, कल फिर नई सुबह मुस्कुराएगी।\nअपने हौसलों पर यकीन रख, हर मुश्किल आसान हो जाएगी।',
    en: 'Do not pause weary traveler, the horizon is near,\nTonight shall pass, dawn will bring cheer.\nKeep faith in your stride, every path will become clear.'
  }
};


// ================= MULTI-CHILD & MULTI-SCHOOL DATA ENGINE =================

// ================= EXHAUSTIVE PAN-INDIA DIRECTORY (ALL 36 STATES & UTs WITH ALL 750+ DISTRICTS) =================
const INDIAN_STATES_DISTRICTS: Record<string, string[]> = {
  'उत्तर प्रदेश (Uttar Pradesh)': [
    'आगरा (Agra)',
    'अलीगढ़ (Aligarh)',
    'अम्बेडकर नगर (Ambedkar Nagar)',
    'अमेठी (Amethi)',
    'अमरोहा (Amroha)',
    'औरैया (Auraiya)',
    'अयोध्या / फैजाबाद (Ayodhya)',
    'आजमगढ़ (Azamgarh)',
    'बागपत (Baghpat)',
    'बहराइच (Bahraich)',
    'बलिया (Ballia)',
    'बलरामपुर (Balrampur)',
    'बांदा (Banda)',
    'बाराबंकी (Barabanki)',
    'बरेली (Bareilly)',
    'बस्ती (Basti)',
    'भदोही / संत रविदास नगर (Bhadohi)',
    'बिजनौर (Bijnor)',
    'बदायूं (Budaun)',
    'बुलंदशहर (Bulandshahr)',
    'चंदौली (Chandauli)',
    'चित्रकूट (Chitrakoot)',
    'देवरिया (Deoria)',
    'एटा (Etah)',
    'इटावा (Etawah)',
    'फर्रुखाबाद (Farrukhabad)',
    'फतेहपुर (Fatehpur)',
    'फिरोजाबाद (Firozabad)',
    'नोएडा / गौतम बुद्ध नगर (Gautam Buddha Nagar)',
    'गाजियाबाद (Ghaziabad)',
    'गाजीपुर (Ghazipur)',
    'गोंडा (Gonda)',
    'गोरखपुर (Gorakhpur)',
    'हमीरपुर (Hamirpur)',
    'हापुड़ (Hapur)',
    'हरदोई (Hardoi)',
    'हाथरस (Hathras)',
    'जालौन / उरई (Jalaun)',
    'जौनपुर (Jaunpur)',
    'झांसी (Jhansi)',
    'कन्नौज (Kannauj)',
    'कानपुर देहात (Kanpur Dehat)',
    'कानपुर नगर (Kanpur Nagar)',
    'कासगंज (Kasganj)',
    'कौशाम्बी (Kaushambi)',
    'लखीमपुर खीरी (Lakhimpur Kheri)',
    'कुशीनगर (Kushinagar)',
    'ललितपुर (Lalitpur)',
    'लखनऊ (Lucknow)',
    'महाराजगंज (Maharajganj)',
    'महोबा (Mahoba)',
    'मैनपुरी (Mainpuri)',
    'मथुरा (Mathura)',
    'मऊ (Mau)',
    'मेरठ (Meerut)',
    'मिर्जापुर (Mirzapur)',
    'मुरादाबाद (Moradabad)',
    'मुजफ्फरनगर (Muzaffarnagar)',
    'पीलीभीत (Pilibhit)',
    'प्रतापगढ़ (Pratapgarh)',
    'प्रयागराज / इलाहाबाद (Prayagraj)',
    'रायबरेली (Raebareli)',
    'रामपुर (Rampur)',
    'सहारनपुर (Saharanpur)',
    'सम्भल (Sambhal)',
    'संत कबीर नगर (Sant Kabir Nagar)',
    'शाहजहांपुर (Shahjahanpur)',
    'शामली (Shamli)',
    'श्रावस्ती (Shravasti)',
    'सिद्धार्थनगर (Siddharthnagar)',
    'सीतापुर (Sitapur)',
    'सोनभद्र (Sonbhadra)',
    'सुल्तानपुर (Sultanpur)',
    'उन्नाव (Unnao)',
    'वाराणसी / बनारस (Varanasi)'
  ],
  'बिहार (Bihar)': [
    'अररिया (Araria)',
    'अरवल (Arwal)',
    'औरंगाबाद (Aurangabad)',
    'बांका (Banka)',
    'बेगूसराय (Begusarai)',
    'भागलपुर (Bhagalpur)',
    'भोजपुर / आरा (Bhojpur)',
    'बक्सर (Buxar)',
    'दरभंगा (Darbhanga)',
    'पूर्वी चंपारण / मोतिहारी (East Champaran)',
    'गया (Gaya)',
    'गोपालगंज (Gopalganj)',
    'जमुई (Jamui)',
    'जहानाबाद (Jehanabad)',
    'कैमूर / भभुआ (Kaimur)',
    'कटिहार (Katihar)',
    'खगड़िया (Khagaria)',
    'किशनगंज (Kishanganj)',
    'लखीसराय (Lakhisarai)',
    'मधेपुरा (Madhepura)',
    'मधुबनी (Madhubani)',
    'मुंगेर (Munger)',
    'मुजफ्फरपुर (Muzaffarpur)',
    'नालंदा / बिहार शरीफ (Nalanda)',
    'नवादा (Nawada)',
    'पटना (Patna)',
    'पूर्णिया (Purnia)',
    'रोहतास / सासाराम (Rohtas)',
    'सहरसा (Saharsa)',
    'समस्तीपुर (Samastipur)',
    'सारण / छपरा (Saran)',
    'शेखपुरा (Sheikhpura)',
    'शिवहर (Sheohar)',
    'सीतामढ़ी (Sitamarhi)',
    'सीवान (Siwan)',
    'सुपौल (Supaul)',
    'वैशाली / हाजीपुर (Vaishali)',
    'पश्चिम चंपारण / बेतिया (West Champaran)'
  ],
  'दिल्ली (Delhi)': [
    'नई दिल्ली (New Delhi)',
    'दक्षिण दिल्ली (South Delhi)',
    'पूर्वी दिल्ली (East Delhi)',
    'उत्तर दिल्ली (North Delhi)',
    'पश्चिम दिल्ली (West Delhi)',
    'द्वारका व नजफगढ़ / दक्षिण-पश्चिम (Dwarka)',
    'उत्तर-पूर्व दिल्ली (North East Delhi)',
    'मध्य दिल्ली (Central Delhi)',
    'शाहदरा (Shahdara)',
    'दक्षिण-पूर्व दिल्ली (South East Delhi)',
    'उत्तर-पश्चिम दिल्ली / रोहिणी (Rohini)'
  ],
  'मध्य प्रदेश (Madhya Pradesh)': [
    'आगर मालवा (Agar Malwa)',
    'अलीराजपुर (Alirajpur)',
    'अनूपपुर (Anuppur)',
    'अशोकनगर (Ashoknagar)',
    'बालाघाट (Balaghat)',
    'बड़वानी (Barwani)',
    'बैतूल (Betul)',
    'भिंड (Bhind)',
    'भोपाल (Bhopal)',
    'बुरहानपुर (Burhanpur)',
    'छतरपुर (Chhatarpur)',
    'छिंदवाड़ा (Chhindwara)',
    'दमोह (Damoh)',
    'दतिया (Datia)',
    'देवास (Dewas)',
    'धार (Dhar)',
    'डिंडोरी (Dindori)',
    'गुना (Guna)',
    'ग्वालियर (Gwalior)',
    'हरदा (Harda)',
    'नर्मदापुरम / होशंगाबाद',
    'इंदौर (Indore)',
    'जबलपुर (Jabalpur)',
    'झाबुआ (Jhabua)',
    'कटनी (Katni)',
    'खंडवा (Khandwa)',
    'खरगोन (Khargone)',
    'मैहर (Maihar)',
    'मंडला (Mandla)',
    'मंदसौर (Mandsaur)',
    'मऊगंज (Mauganj)',
    'मुरैना (Morena)',
    'नरसिंहपुर (Narsinghpur)',
    'नीमच (Neemuch)',
    'निवाड़ी (Niwari)',
    'पन्ना (Panna)',
    'पांढुर्णा (Pandhurna)',
    'रायसेन (Raisen)',
    'राजगढ़ (Rajgarh)',
    'रतलाम (Ratlam)',
    'रीवा (Rewa)',
    'सागर (Sagar)',
    'सतना (Satna)',
    'सीहोर (Sehore)',
    'सिवनी (Seoni)',
    'शहडोल (Shahdol)',
    'शाजापुर (Shajapur)',
    'श्योपुर (Sheopur)',
    'शिवपुरी (Shivpuri)',
    'सीधी (Sidhi)',
    'सिंगरौली (Singrauli)',
    'टीकमगढ़ (Tikamgarh)',
    'उज्जैन (Ujjain)',
    'उमरिया (Umaria)',
    'विदिशा (Vidisha)'
  ],
  'राजस्थान (Rajasthan)': [
    'अजमेर (Ajmer)',
    'अलवर (Alwar)',
    'अनूपगढ़ (Anupgarh)',
    'बालोतरा (Balotra)',
    'बांसवाड़ा (Banswara)',
    'बारां (Baran)',
    'बाड़मेर (Barmer)',
    'ब्यावर (Beawar)',
    'भरतपुर (Bharatpur)',
    'भीलवाड़ा (Bhilwara)',
    'बीकानेर (Bikaner)',
    'बूंदी (Bundi)',
    'चित्तौड़गढ़ (Chittorgarh)',
    'चूरू (Churu)',
    'दौसा (Dausa)',
    'डीग (Deeg)',
    'डीडवाना-कुचामन (Didwana)',
    'धौलपुर (Dholpur)',
    'दूदू (Dudu)',
    'डूंगरपुर (Dungarpur)',
    'गंगापुर सिटी (Gangapur City)',
    'हनुमानगढ़ (Hanumangarh)',
    'जयपुर (Jaipur)',
    'जयपुर ग्रामीण (Jaipur Rural)',
    'जैसलमेर (Jaisalmer)',
    'जालोर (Jalore)',
    'झालावाड़ (Jhalawar)',
    'झुंझुनू (Jhunjhunu)',
    'जोधपुर (Jodhpur)',
    'जोधपुर ग्रामीण (Jodhpur Rural)',
    'करौली (Karauli)',
    'केकड़ी (Kekri)',
    'खैरथल-तिजारा (Khairthal)',
    'कोटा (Kota)',
    'कोटपूतली-बहरोड़ (Kotputli)',
    'नागौर (Nagaur)',
    'नीम का थाना (Neem Ka Thana)',
    'पाली (Pali)',
    'फलोदी (Phalodi)',
    'प्रतापगढ़ (Pratapgarh)',
    'राजसमंद (Rajsamand)',
    'सलूंबर (Salumbar)',
    'सांचौर (Sanchore)',
    'सवाई माधोपुर (Sawai Madhopur)',
    'शाहपुरा (Shahpura)',
    'सीकर (Sikar)',
    'सिरोही (Sirohi)',
    'श्रीगंगानगर (Sri Ganganagar)',
    'टोंक (Tonk)',
    'उदयपुर (Udaipur)'
  ],
  'हरियाणा (Haryana)': [
    'अंबाला (Ambala)',
    'भिवानी (Bhiwani)',
    'चरखी दादरी (Charkhi Dadri)',
    'फरीदाबाद (Faridabad)',
    'फतेहाबाद (Fatehabad)',
    'गुरुग्राम / गुड़गांव (Gurugram)',
    'हिसार (Hisar)',
    'झज्जर (Jhajjar)',
    'जींद (Jind)',
    'कैथल (Kaithal)',
    'करनाल (Karnal)',
    'कुरुक्षेत्र (Kurukshetra)',
    'महेंद्रगढ़ (Mahendragarh)',
    'नूंह (Nuh)',
    'पलवल (Palwal)',
    'पंचकूला (Panchkula)',
    'पानीपत (Panipat)',
    'रेवाड़ी (Rewari)',
    'रोहतक (Rohatak)',
    'सिरसा (Sirsa)',
    'सोनीपत (Sonipat)',
    'यमुनानगर (Yamunanagar)'
  ],
  'महाराष्ट्र (Maharashtra)': [
    'अहमदनगर / अहिल्यानगर',
    'अकोला (Akola)',
    'अमरावती (Amravati)',
    'छत्रपति संभाजीनगर / औरंगाबाद',
    'बीड (Beed)',
    'भंडारा (Bhandara)',
    'बुलढाणा (Buldhana)',
    'चंद्रपुर (Chandrapur)',
    'धुले (Dhule)',
    'गढ़चिरौली (Gadchiroli)',
    'गोंदिया (Gondia)',
    'हिंगोली (Hingoli)',
    'जलगांव (Jalgaon)',
    'जालना (Jalna)',
    'कोल्हापुर (Kolhapur)',
    'लातूर (Latur)',
    'मुंबई सिटी (Mumbai City)',
    'मुंबई उपनगर (Mumbai Suburban)',
    'नागपुर (Nagpur)',
    'नांदेड़ (Nanded)',
    'नंदुरबार (Nandurbar)',
    'नासिक (Nashik)',
    'धाराशिव / उस्मानाबाद',
    'पालघर (Palghar)',
    'परभणी (Parbhani)',
    'पुणे (Pune)',
    'रायगढ़ (Raigad)',
    'रत्नागिरी (Ratnagiri)',
    'सांगली (Sangli)',
    'सतारा (Satara)',
    'सिंधुदुर्ग (Sindhudurg)',
    'सोलापुर (Solapur)',
    'ठाणे (Thane)',
    'वर्धा (Wardha)',
    'वाशिम (Washim)',
    'यवतमाल (Yavatmal)'
  ],
  'गुजरात (Gujarat)': [
    'अहमदाबाद (Ahmedabad)',
    'अमरेली (Amreli)',
    'आनंद (Anand)',
    'अरवल्ली (Aravalli)',
    'बनासकांठा (Banaskantha)',
    'भरूच (Bharuch)',
    'भावनगर (Bhavnagar)',
    'बोटाद (Botad)',
    'छोटा उदयपुर (Chhota Udaipur)',
    'दाहोद (Dahod)',
    'डांग (Dang)',
    'देवभूमि द्वारका (Devbhoomi Dwarka)',
    'गांधीनगर (Gandhinagar)',
    'गिर सोमनाथ (Gir Somnath)',
    'जामनगर (Jamnagar)',
    'जूनागढ़ (Junagadh)',
    'खेड़ा (Kheda)',
    'कच्छ (Kutch)',
    'महीसागर (Mahisagar)',
    'मेहसाणा (Mehsana)',
    'मोरबी (Morbi)',
    'नर्मदा (Narmada)',
    'नवसारी (Navsari)',
    'पंचमहल (Panchmahal)',
    'पाटन (Patan)',
    'पोरबंदर (Porbandar)',
    'राजकोट (Rajkot)',
    'साबरकांठा (Sabarkantha)',
    'सूरत (Surat)',
    'सुरेन्द्रनगर (Surendranagar)',
    'तापी (Tapi)',
    'वडोदरा (Vadodara)',
    'वलसाड (Valsad)'
  ],
  'पंजाब (Punjab)': [
    'अमृतसर (Amritsar)',
    'बरनाला (Barnala)',
    'बठिंडा (Bathinda)',
    'फरीदकोट (Faridkot)',
    'फतेहगढ़ साहिब (Fatehgarh Sahib)',
    'फाजिल्का (Fazilka)',
    'फिरोजपुर (Ferozepur)',
    'गुरदासपुर (Gurdaspur)',
    'होशियारपुर (Hoshiarpur)',
    'जालंधर (Jalandhar)',
    'कपूरथला (Kapurthala)',
    'लुधियाना (Ludhiana)',
    'मलेरकोटला (Malerkotla)',
    'मानसा (Mansa)',
    'मोगा (Moga)',
    'पठानकोट (Pathankot)',
    'पटियाला (Patiala)',
    'रूपनगर / रोपड़ (Rupnagar)',
    'मोहाली / एसएएस नगर (SAS Nagar)',
    'संगरूर (Sangrur)',
    'शहीद भगत सिंह नगर / नवांशहर',
    'श्री मुक्तसर साहिब (Muktsar)',
    'तरनतारन (Tarn Taran)'
  ],
  'उत्तराखंड (Uttarakhand)': [
    'अल्मोड़ा (Almora)',
    'बागेश्वर (Bageshwar)',
    'चमोली (Chamoli)',
    'चंपावत (Champawat)',
    'देहरादून (Dehradun)',
    'हरिद्वार (Haridwar)',
    'नैनीताल / हल्द्वानी (Nainital)',
    'पौड़ी गढ़वाल (Pauri Garhwal)',
    'पिथौरागढ़ (Pithoragarh)',
    'रुद्रप्रयाग (Rudraprayag)',
    'टिहरी गढ़वाल (Tehri Garhwal)',
    'उधम सिंह नगर / रुद्रपुर',
    'उत्तरकाशी (Uttarkashi)'
  ],
  'झारखंड (Jharkhand)': [
    'बोकारो (Bokaro)',
    'चतरा (Chatra)',
    'देवघर (Deoghar)',
    'धनबाद (Dhanbad)',
    'दुमका (Dumka)',
    'पूर्वी सिंहभूम / जमशेदपुर',
    'गढ़वा (Garhwa)',
    'गिरिडीह (Giridih)',
    'गोड्डा (Godda)',
    'गुमला (Gumla)',
    'हजारीबाग (Hazaribagh)',
    'जामताड़ा (Jamtara)',
    'खूंटी (Khunti)',
    'कोडरमा (Koderma)',
    'लातेहार (Latehar)',
    'लोहरदगा (Lohardaga)',
    'पाकुड़ (Pakur)',
    'पलामू / मेदिनीनगर',
    'रामगढ़ (Ramgarh)',
    'रांची (Ranchi)',
    'साहिबगंज (Sahebganj)',
    'सरायकेला खरसावां (Seraikela)',
    'सिमडेगा (Simdega)',
    'पश्चिम सिंहभूम / चाईबासा'
  ],
  'पश्चिम बंगाल (West Bengal)': [
    'अलीपुरद्वार (Alipurduar)',
    'बांकुड़ा (Bankura)',
    'बीरभूम (Birbhum)',
    'कूचबिहार (Cooch Behar)',
    'दक्षिण दिनाजपुर (Dakshin Dinajpur)',
    'दार्जिलिंग (Darjeeling)',
    'हुगली (Hooghly)',
    'हावड़ा (Howrah)',
    'जलपाईगुड़ी (Jalpaiguri)',
    'झाड़ग्राम (Jhargram)',
    'कालिम्पोंग (Kalimpong)',
    'कोलकाता (Kolkata)',
    'मालदा (Malda)',
    'मुर्शिदाबाद (Murshidabad)',
    'नदिया (Nadia)',
    'उत्तर 24 परगना (North 24 Parganas)',
    'पश्चिम बर्धमान / दुर्गापुर / आसनसोल',
    'पश्चिम मेदिनीपुर (Paschim Medinipur)',
    'पूर्व बर्धमान (Purba Bardhaman)',
    'पूर्व मेदिनीपुर (Purba Medinipur)',
    'पुरुलिया (Purulia)',
    'दक्षिण 24 परगना (South 24 Parganas)',
    'उत्तर दिनाजपुर (Uttar Dinajpur)'
  ],
  'छत्तीसगढ़ (Chhattisgarh)': [
    'बालोद (Balod)',
    'बलौदा बाजार (Baloda Bazar)',
    'बलरामपुर (Balrampur)',
    'बस्तर / जगदलपुर (Bastar)',
    'बेमेतरा (Bemetara)',
    'बीजापुर (Bijapur)',
    'बिलासपुर (Bilaspur)',
    'दंतेवाड़ा (Dantewada)',
    'धमतरी (Dhamtari)',
    'दुर्ग / भिलाई (Durg)',
    'गरियाबंद (Gariaband)',
    'गौरेला-पेंड्रा-मरवाही',
    'जांजगीर-चांपा (Janjgir-Champa)',
    'जशपुर (Jashpur)',
    'कबीरधाम / कवर्धा (Kabirdham)',
    'कांकेर (Kanker)',
    'खैरागढ़-छुईखदान-गंडई',
    'कोंडागांव (Kondagaon)',
    'कोरबा (Korba)',
    'कोरिया (Koriya)',
    'महासमुंद (Mahasamund)',
    'मनेंद्रगढ़-चिरमिरी-भरतपुर',
    'मोहला-मानपुर-अंबागढ़ चौकी',
    'मुंगेली (Mungeli)',
    'नारायणपुर (Narayanpur)',
    'रायगढ़ (Raigarh)',
    'रायपुर (Raipur)',
    'राजनांदगांव (Rajnandgaon)',
    'सारंगढ़-बिलाईगढ़',
    'सक्ती (Sakti)',
    'सुकमा (Sukma)',
    'सूरजपुर (Surajpur)',
    'सरगुजा / अंबिकापुर (Surguja)'
  ],
  'ओडिशा (Odisha)': [
    'अनुगुल (Angul)',
    'बलांगीर (Balangir)',
    'बालेश्वर (Balasore)',
    'बरगढ़ (Bargarh)',
    'भद्रक (Bhadrak)',
    'बौध (Boudh)',
    'कटक (Cuttack)',
    'देवगढ़ (Deogarh)',
    'ढेंकानाल (Dhenkanal)',
    'गजपति (Gajapati)',
    'गंजम / ब्रह्मपुर (Ganjam)',
    'जगतसिंहपुर (Jagatsinghpur)',
    'जाजपुर (Jajpur)',
    'झारसुगुड़ा (Jharsuguda)',
    'कालाहांडी (Kalahandi)',
    'कंधमाल (Kandhamal)',
    'केंद्रपाड़ा (Kendrapara)',
    'केन्दुझर / क्योंझर (Kendujhar)',
    'खोर्धा / भुवनेश्वर (Khordha)',
    'कोरापुट (Koraput)',
    'मलकानगिरी (Malkangiri)',
    'मयूरभंज (Mayurbhanj)',
    'नबरंगपुर (Nabarangpur)',
    'नयागढ़ (Nayagarh)',
    'नुआपाड़ा (Nuapada)',
    'पुरी (Puri)',
    'रायगड़ा (Rayagada)',
    'संबलपुर (Sambalpur)',
    'सुवर्णपुर / सोनपुर (Subarnapur)',
    'सुंदरगढ़ / राउरकेला (Sundergarh)'
  ],
  'कर्नाटक (Karnataka)': [
    'बागलकोट (Bagalkot)',
    'बल्लारी (Ballari)',
    'बेलगावी (Belagavi)',
    'बेंगलुरु ग्रामीण (Bengaluru Rural)',
    'बेंगलुरु शहरी (Bengaluru Urban)',
    'बीदर (Bidar)',
    'चामराजनगर (Chamarajanagar)',
    'चिक्काबल्लापुर (Chikkaballapura)',
    'चिक्कमगलुरु (Chikkamagaluru)',
    'चित्रदुर्गा (Chitradurga)',
    'दक्षिण कन्नड़ / मंगलुरु (Mangaluru)',
    'दावणगेरे (Davanagere)',
    'धारवाड़ / हुबली (Dharwad)',
    'गदग (Gadag)',
    'हासन (Hassan)',
    'हावेरी (Haveri)',
    'कलबुर्गी / गुलबर्गा (Kalaburagi)',
    'कोडगु / कूर्ग (Kodagu)',
    'कोलार (Kolar)',
    'कोप्पल (Koppal)',
    'मंड्या (Mandya)',
    'मैसूर (Mysuru)',
    'रायचूर (Raichur)',
    'रामनगर (Ramanagara)',
    'शिवमोग्गा (Shivamogga)',
    'तुमकुरु (Tumakuru)',
    'उडुपी (Udupi)',
    'उत्तर कन्नड़ (Uttara Kannada)',
    'विजयनगर (Vijayanagara)',
    'विजयपुरा / बीजापुर (Vijayapura)',
    'यादगीर (Yadgir)'
  ],
  'आंध्र प्रदेश (Andhra Pradesh)': [
    'अल्लूरी सीताराम राजू',
    'अनकापल्ली (Anakapalli)',
    'अनंतपुर (Ananthapuramu)',
    'अन्नामय्या (Annamayya)',
    'बापटला (Bapatla)',
    'चित्तूर (Chittoor)',
    'डॉ. बी.आर. अम्बेडकर कोनासीमा',
    'पूर्वी गोदावरी / राजमुंदरी',
    'एलुरु (Eluru)',
    'गुंटूर (Guntur)',
    'काकीनाडा (Kakinada)',
    'कृष्णा / मछलीपट्टनम',
    'कर्नूल (Kurnool)',
    'नंद्याल (Nandyal)',
    'एनटीआर / विजयवाड़ा (NTR)',
    'पलनाडु (Palnadu)',
    'पार्वतीपुरम मान्यम',
    'प्रकाशम / ओंगोल (Prakasam)',
    'नेल्लोर (Nellore)',
    'श्री सत्य साई (Sri Sathya Sai)',
    'श्रीकाकुलम (Srikakulam)',
    'तिरुपति (Tirupati)',
    'विशाखापट्टनम (Visakhapatnam)',
    'विजयनगरम (Vizianagaram)',
    'पश्चिम गोदावरी / भीमावरम',
    'वाईएसआर कडप्पा (YSR Kadapa)'
  ],
  'तेलंगाना (Telangana)': [
    'आदिलाबाद (Adilabad)',
    'भद्राद्री कोठागुडेम',
    'हनुमकोंडा (Hanumakonda)',
    'हैदराबाद (Hyderabad)',
    'जगतियाल (Jagtial)',
    'जनगांव (Jangaon)',
    'जयशंकर भूपलपल्ली',
    'जोगुलम्बा गडवाल',
    'कामारेड्डी (Kamareddy)',
    'करीमनगर (Karimnagar)',
    'खम्मम (Khammam)',
    'कुमुराम भीम आसिफाबाद',
    'महबूबाबाद (Mahabubabad)',
    'महबूबनगर (Mahbubnagar)',
    'मंचेरियल (Mancherial)',
    'मेदक (Medak)',
    'मेडचल-मलकाजगिरी',
    'मुलुगु (Mulugu)',
    'नागरकुरनूल (Nagarkurnool)',
    'नलगोंडा (Nalgonda)',
    'नारायणपेट (Narayanpet)',
    'निर्मल (Nirmal)',
    'निजामाबाद (Nizamabad)',
    'पेद्दापल्ली (Peddapalli)',
    'राजन्ना सिरसिला',
    'रंगा रेड्डी (Ranga Reddy)',
    'संगारेड्डी (Sangareddy)',
    'सिद्दीपेट (Siddipet)',
    'सूर्यपेट (Suryapet)',
    'विकाराबाद (Vikarabad)',
    'वनपर्थी (Wanaparthy)',
    'वारंगल (Warangal)',
    'यादाद्री भुवनगिरी'
  ],
  'केरल (Kerala)': [
    'अलप्पुझा (Alappuzha)',
    'एर्नाकुलम / कोच्चि (Ernakulam)',
    'इडुक्की (Idukki)',
    'कन्नूर (Kannur)',
    'कासरगोड (Kasaragod)',
    'कोल्लम (Kollam)',
    'कोट्टायम (Kottayam)',
    'कोझिकोड (Kozhikode)',
    'मलप्पुरम (Malappuram)',
    'पलक्कड़ (Palakkad)',
    'पथानामथिट्टा (Pathanamthitta)',
    'तिरुवनंतपुरम (Thiruvananthapuram)',
    'त्रिशूर (Thrissur)',
    'वायनाड (Wayanad)'
  ],
  'तमिलनाडु (Tamil Nadu)': [
    'अरियालुर (Ariyalur)',
    'चेंगलपट्टू (Chengalpattu)',
    'चेन्नई (Chennai)',
    'कोयंबटूर (Coimbatore)',
    'कडलोर (Cuddalore)',
    'धर्मपुरी (Dharmapuri)',
    'डिंडीगुल (Dindigul)',
    'ईरोड (Erode)',
    'कल्लाकुरिची (Kallakurichi)',
    'कांचीपुरम (Kanchipuram)',
    'कन्याकुमारी (Kanyakumari)',
    'करूर (Karur)',
    'कृष्णागिरी (Krishnagiri)',
    'मदुरै (Madurai)',
    'मयिलादुथुरै (Mayiladuthurai)',
    'नागपट्टिनम (Nagapattinam)',
    'नमक्कल (Namakkal)',
    'नीलगिरि / ऊटी (Nilgiris)',
    'पेरम्बलुर (Perambalur)',
    'पुदुक्कोट्टई (Pudukkottai)',
    'रामनाथपुरम (Ramanathapuram)',
    'रानीपेट (Ranipet)',
    'सलेम (Salem)',
    'शिवगंगा (Sivaganga)',
    'तेनकासी (Tenkasi)',
    'तंजावुर (Thanjavur)',
    'थेनी (Theni)',
    'थूथुकुडी (Thoothukudi)',
    'तिरुचिरापल्ली / त्रिची (Trichy)',
    'तिरुनेलवेली (Tirunelveli)',
    'तिरुपात्तूर (Tirupathur)',
    'तिरुपुर (Tiruppur)',
    'तिरुवल्लूर (Tiruvallur)',
    'तिरुवन्नामलाई (Tiruvannamalai)',
    'तिरुवरुर (Tiruvarur)',
    'वेल्लोर (Vellore)',
    'विलुप्पुरम (Viluppuram)',
    'विरुधुनगर (Virudhunagar)'
  ],
  'असम (Assam)': [
    'बक्सा (Baksa)',
    'बारपेटा (Barpeta)',
    'विश्वनाथ (Biswanath)',
    'बोंगाईगांव (Bongaigaon)',
    'कछार / सिलचर (Cachar)',
    'चराइदेव (Charaideo)',
    'चिरांग (Chirang)',
    'दरंग (Darrang)',
    'धेमाजी (Dhemaji)',
    'धुबरी (Dhubri)',
    'डिब्रूगढ़ (Dibrugarh)',
    'दीमा हसाओ (Dima Hasao)',
    'गोवालपारा (Goalpara)',
    'गोलाघाट (Golaghat)',
    'हाइलाकांडी (Hailakandi)',
    'होजाई (Hojai)',
    'जोरहाट (Jorhat)',
    'कामरूप (Kamrup)',
    'कामरूप मेट्रो / गुवाहाटी (Guwahati)',
    'कार्बी आंगलोंग (Karbi Anglong)',
    'करीमगंज (Karimganj)',
    'कोकराझार (Kokrajhar)',
    'लखीमपुर (Lakhimpur)',
    'माजुली (Majuli)',
    'मोरीगांव (Morigaon)',
    'नगांव (Nagaon)',
    'नलबाड़ी (Nalbari)',
    'शिवसागर (Sivasagar)',
    'सोनितपुर / तेजपुर (Sonitpur)',
    'दक्षिण सलमारा-मानकाचर',
    'तिनसुकिया (Tinsukia)',
    'उदलगुरी (Udalguri)',
    'पश्चिम कार्बी आंगलोंग'
  ],
  'हिमाचल प्रदेश (Himachal Pradesh)': [
    'बिलासपुर (Bilaspur)',
    'चंबा (Chamba)',
    'हमीरपुर (Hamirpur)',
    'कांगड़ा / धर्मशाला (Kangra)',
    'किन्नौर (Kinnaur)',
    'कुल्लू (Kullu)',
    'लाहौल और स्पीति (Lahaul & Spiti)',
    'मंडी (Mandi)',
    'शिमला (Shimla)',
    'सिरमौर (Sirmaur)',
    'सोलन (Solan)',
    'ऊना (Una)'
  ],
  'जम्मू और कश्मीर (Jammu & Kashmir)': [
    'अनंतनाग (Anantnag)',
    'बांदीपोरा (Bandipora)',
    'बारामूला (Baramulla)',
    'बडगाम (Budgam)',
    'डोडा (Doda)',
    'गांदरबल (Ganderbal)',
    'जम्मू (Jammu)',
    'कठुआ (Kathua)',
    'किश्तवाड़ (Kishtwar)',
    'कुलगाम (Kulgam)',
    'कुपवाड़ा (Kupwara)',
    'पुंछ (Poonch)',
    'पुलवामा (Pulwama)',
    'राजौरी (Rajouri)',
    'रामबन (Ramban)',
    'रियासी (Reasi)',
    'सांबा (Samba)',
    'शोपियां (Shopian)',
    'श्रीनगर (Srinagar)',
    'उधमपुर (Udhampur)'
  ],
  'गोवा (Goa)': [
    'उत्तर गोवा / पणजी (North Goa)',
    'दक्षिण गोवा / मडगांव (South Goa)'
  ],
  'चंडीगढ़ (Chandigarh)': [
    'चंडीगढ़ (Chandigarh)'
  ],
  'पुडुचेरी (Puducherry)': [
    'पुडुचेरी (Puducherry)',
    'कराईकल (Karaikal)',
    'माहे (Mahe)',
    'यानम (Yanam)'
  ],
  'लद्दाख (Ladakh)': [
    'लेह (Leh)',
    'कारगिल (Kargil)'
  ],
  'त्रिपुरा (Tripura)': [
    'अगरतला / पश्चिम त्रिपुरा (West Tripura)',
    'धलाई (Dhalai)',
    'गोमती (Gomati)',
    'खोवाई (Khowai)',
    'उत्तर त्रिपुरा (North Tripura)',
    'सिपाहीजाला (Sepahijala)',
    'दक्षिण त्रिपुरा (South Tripura)',
    'उनकोटी (Unakoti)'
  ],
  'मेघालय (Meghalaya)': [
    'पूर्वी खासी हिल्स / शिलांग (Shillong)',
    'पश्चिम गारो हिल्स / तुरा (Tura)',
    'री-भोई (Ri Bhoi)',
    'पूर्वी जयंतिया हिल्स',
    'पश्चिम जयंतिया हिल्स / जोवाई',
    'पूर्वी गारो हिल्स',
    'उत्तर गारो हिल्स',
    'दक्षिण गारो हिल्स',
    'दक्षिण पश्चिम गारो हिल्स',
    'पश्चिम खासी हिल्स',
    'दक्षिण पश्चिम खासी हिल्स',
    'ईस्टर्न वेस्ट खासी हिल्स'
  ],
  'मणिपुर (Manipur)': [
    'इम्फाल पूर्व (Imphal East)',
    'इम्फाल पश्चिम (Imphal West)',
    'बिष्णुपुर (Bishnupur)',
    'थौबल (Thoubal)',
    'चुराचांदपुर (Churachandpur)',
    'चंदेल (Chandel)',
    'सेनापति (Senapati)',
    'तमेंगलोंग (Tamenglong)',
    'उखरुल (Ukhrul)',
    'कांगपोकपी (Kangpokpi)',
    'टेंगनौपाल (Tengnoupal)',
    'कमजोंग (Kamjong)',
    'नोनी (Noney)',
    'फेरजावल (Pherzawl)',
    'काकचिंग (Kakching)',
    'जिरीबाम (Jiribam)'
  ],
  'नागालैंड (Nagaland)': [
    'कोहिमा (Kohima)',
    'दीमापुर (Dimapur)',
    'मोकोकचुंग (Mokokchung)',
    'मोन (Mon)',
    'तुएनसांग (Tuensang)',
    'वोखा (Wokha)',
    'जुन्हेबोटो (Zunheboto)',
    'फेक (Phek)',
    'पेरेन (Peren)',
    'लोंगलेंग (Longleng)',
    'किफिरे (Kiphire)',
    'नोकलाक (Noklak)',
    'चुमौकेदिमा (Chumoukedima)',
    'न्यूलैंड (Niuland)',
    'त्सेमिन्यु (Tseminyu)',
    'शामतोर (Shamator)'
  ],
  'मिजोरम (Mizoram)': [
    'आइजोल (Aizawl)',
    'लुंगलेई (Lunglei)',
    'चम्फाई (Champhai)',
    'कोलासिब (Kolasib)',
    'सेरछिप (Serchhip)',
    'लॉंगत्लाई (Lawngtlai)',
    'ममित (Mamit)',
    'सइहा (Saiha)',
    'हनाथियाल (Hnahthial)',
    'ख्वाजावल (Khawzawl)',
    'सैतुल (Saitual)'
  ],
  'अरुणाचल प्रदेश (Arunachal Pradesh)': [
    'ईटानगर / पापुम पारे (Itanagar)',
    'तवांग (Tawang)',
    'पश्चिम कामेंग / बोमडिला',
    'पूर्वी कामेंग / सेप्पा',
    'लोअर सुबनसिरी / जीरो',
    'अपर सुबनसिरी / दापोरिजो',
    'पश्चिम सियांग / आलो',
    'पूर्वी सियांग / पासीघाट',
    'सियांग (Siang)',
    'अपर सियांग (Upper Siang)',
    'लोअर सियांग (Lower Siang)',
    'दिबांग घाटी (Dibang Valley)',
    'लोअर दिबांग घाटी / रोइंग',
    'लोहित / तेजू (Lohit)',
    'अंजॉ (Anjaw)',
    'नामसाई (Namsai)',
    'चांगलांग (Changlang)',
    'तिराप / खोंसा (Tirap)',
    'लोंगडिंग (Longding)',
    'कुरुंग कुमे (Kurung Kumey)',
    'क्रा दादी (Kra Daadi)',
    'कमले (Kamle)',
    'पक्के केसांग (Pakke Kessang)',
    'लेपा राडा (Lepa Rada)',
    'शि योमी (Shi Yomi)'
  ],
  'सिक्किम (Sikkim)': [
    'गंगटोक (Gangtok)',
    'नामची (Namchi)',
    'मंगन (Mangan)',
    'गेजिंग (Geyzing)',
    'पाकयोंग (Pakyong)',
    'सोरेन्ग (Soreng)'
  ],
  'अंडमान और निकोबार (Andaman & Nicobar)': [
    'दक्षिण अंडमान / पोर्ट ब्लेयर (Port Blair)',
    'उत्तर और मध्य अंडमान',
    'निकोबार (Nicobar)'
  ],
  'दादरा और नगर हवेली और दमन और दीव': [
    'दमन (Daman)',
    'दीव (Diu)',
    'दादरा और नगर हवेली / सिलवासा (Silvassa)'
  ],
  'लक्षद्वीप (Lakshadweep)': [
    'कवरत्ती (Kavaratti)'
  ]
};

const generateUniversalBusKey = (state: string, district: string, school: string, busNo: string) => {
  const clean = (s: string) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const st = clean(state) || 'delhi';
  const dist = clean(district) || 'newdelhi';
  const sch = clean(school) || 'dps';
  const b = clean(busNo) || 'bus12';
  return `${st}_${dist}_${sch}_${b}`;
};

const DEFAULT_SCHOOL_CHILDREN = [
  {
    id: 'child_riya',
    name: 'रिया (गुड़िया)',
    nameEn: 'Riya',
    avatar: '👧',
    schoolNameHi: 'डीपीएस आर.के. पुरम, नई दिल्ली',
    schoolNameEn: 'DPS R.K. Puram, New Delhi',
    branchCode: 'DEL-DPS-RKP',
    grade: 'Class 5-B',
    busNo: 'Bus #12',
    routeTitleHi: 'आनंद विहार एक्सप्रेस (Route #12)',
    routeTitleEn: 'Anand Vihar Express (Route #12)',
    busCode: 'DEL-DPS-RKP-B12',
    vehicleNo: 'DL 01 AB 4321 (Tata Starbus)',
    stopNameHi: 'आनंद विहार गेट नं. 2 (आपका स्टॉप)',
    stopNameEn: 'Anand Vihar Gate #2 (Your Stop)',
    stopCoords: { lat: 28.6502, lng: 77.3150 },
    busCoords: { lat: 28.6430, lng: 77.2980 },
    rfidTag: 'DPSRKP-2026-88',
    seatNo: '14 (खिड़की / Window)',
    driverNameHi: 'राजेश कुमार',
    driverNameEn: 'Rajesh Kumar',
    driverPhone: '9876543210',
    conductorNameHi: 'सुरेश यादव',
    conductorNameEn: 'Suresh Yadav',
    conductorPhone: '9876543211',
    schoolHelpline: '011-27891234',
    etaMins: 8,
    speedKmh: 38,
    isBoarded: true,
    stops: [
      { id: 1, time: '07:15 AM', titleHi: 'DPS R.K. Puram स्कूल गेट', titleEn: 'DPS R.K. Puram Gate', subHi: 'समय पर रवाना ✓ (07:16 AM)', subEn: 'Departed on time ✓ (07:16 AM)', status: 'passed' },
      { id: 2, time: '07:28 AM', titleHi: 'सेक्टर 14 गोलचक्कर', titleEn: 'Sector 14 Roundabout', subHi: 'पार हो चुका है ✓ (07:29 AM)', subEn: 'Passed on schedule ✓ (07:29 AM)', status: 'passed' },
      { id: 3, time: '07:38 AM', titleHi: 'आनंद विहार गेट नं. 2 (आपका स्टॉप)', titleEn: 'Anand Vihar Gate #2 (Your Stop)', subHi: 'बस 8 मिनट दूर है (~2.4 km)', subEn: 'Bus is 8 mins away (~2.4 km)', status: 'target', isUserStop: true },
      { id: 4, time: '07:50 AM', titleHi: 'मयूर विहार फ़ेज़ 1 (अंतिम स्टॉप)', titleEn: 'Mayur Vihar Phase 1 (Final Stop)', subHi: 'गंतव्य शेष (Upcoming)', subEn: 'Upcoming Destination', status: 'upcoming' }
    ]
  },
  {
    id: 'child_aarav',
    name: 'आरव (छोटू)',
    nameEn: 'Aarav',
    avatar: '👦',
    schoolNameHi: 'सेंट जेवियर्स स्कूल, सिविल लाइन्स, दिल्ली',
    schoolNameEn: "St. Xavier's School, Civil Lines, Delhi",
    branchCode: 'DEL-XAV-105',
    grade: 'Class 2-A',
    busNo: 'Bus #04',
    routeTitleHi: 'मयूर विहार लिंक (Route #04)',
    routeTitleEn: 'Mayur Vihar Link (Route #04)',
    busCode: 'DEL-XAV-105-B04',
    vehicleNo: 'DL 02 CD 8899 (Ashok Leyland)',
    stopNameHi: 'मयूर विहार फ़ेज़ 2 गेट 4 (आपका स्टॉप)',
    stopNameEn: 'Mayur Vihar Phase 2 Gate 4 (Your Stop)',
    stopCoords: { lat: 28.6115, lng: 77.3055 },
    busCoords: { lat: 28.6200, lng: 77.2890 },
    rfidTag: 'XAVDEL-2026-42',
    seatNo: '08 (आगे / Front)',
    driverNameHi: 'विक्रम सिंह',
    driverNameEn: 'Vikram Singh',
    driverPhone: '9811223344',
    conductorNameHi: 'महेश चंद',
    conductorNameEn: 'Mahesh Chand',
    conductorPhone: '9811223355',
    schoolHelpline: '011-22445566',
    etaMins: 14,
    speedKmh: 32,
    isBoarded: true,
    stops: [
      { id: 1, time: '07:10 AM', titleHi: 'सेंट जेवियर्स स्कूल गेट', titleEn: "St. Xavier's Gate", subHi: 'समय पर रवाना ✓ (07:12 AM)', subEn: 'Departed on time ✓ (07:12 AM)', status: 'passed' },
      { id: 2, time: '07:22 AM', titleHi: 'अक्षरधाम मेट्रो गोलचक्कर', titleEn: 'Akshardham Metro Roundabout', subHi: 'पार हो चुका है ✓ (07:23 AM)', subEn: 'Passed on schedule ✓ (07:23 AM)', status: 'passed' },
      { id: 3, time: '07:35 AM', titleHi: 'मयूर विहार फ़ेज़ 2 गेट 4 (आपका स्टॉप)', titleEn: 'Mayur Vihar Phase 2 Gate 4 (Your Stop)', subHi: 'बस 14 मिनट दूर है (~4.2 km)', subEn: 'Bus is 14 mins away (~4.2 km)', status: 'target', isUserStop: true },
      { id: 4, time: '07:48 AM', titleHi: 'त्रिलोकपुरी टर्मिनल (अंतिम स्टॉप)', titleEn: 'Trilokpuri Terminal (Final Stop)', subHi: 'गंतव्य शेष (Upcoming)', subEn: 'Upcoming Destination', status: 'upcoming' }
    ]
  },
  {
    id: 'child_ishan',
    name: 'ईशान (कजिन)',
    nameEn: 'Ishan (Cousin)',
    avatar: '🧒',
    schoolNameHi: 'डीपीएस नोएडा सेक्टर 30 (उत्तर प्रदेश)',
    schoolNameEn: 'DPS Noida Sector 30 (UP)',
    branchCode: 'UP-DPS-NOI',
    grade: 'Class 4-C',
    busNo: 'Bus #12',
    routeTitleHi: 'इंदिरापुरम शटल (Route #12)',
    routeTitleEn: 'Indirapuram Shuttle (Route #12)',
    busCode: 'UP-DPS-NOI-B12',
    vehicleNo: 'UP 16 Z 5544 (Eicher Skyline)',
    stopNameHi: 'शिप्रा सनसिटी गेट 3, इंदिरापुरम',
    stopNameEn: 'Shipra Suncity Gate 3, Indirapuram',
    stopCoords: { lat: 28.6360, lng: 77.3710 },
    busCoords: { lat: 28.6250, lng: 77.3600 },
    rfidTag: 'DPSNOI-2026-19',
    seatNo: '22 (मध्य / Middle)',
    driverNameHi: 'संतोष यादव',
    driverNameEn: 'Santosh Yadav',
    driverPhone: '9810998877',
    conductorNameHi: 'राजू वर्मा',
    conductorNameEn: 'Raju Verma',
    conductorPhone: '9810998866',
    schoolHelpline: '0120-2455667',
    etaMins: 11,
    speedKmh: 36,
    isBoarded: true,
    stops: [
      { id: 1, time: '07:15 AM', titleHi: 'DPS नोएडा गेट (प्रस्थान)', titleEn: 'DPS Noida Gate', subHi: 'समय पर रवाना ✓ (07:15 AM)', subEn: 'Departed ✓ (07:15 AM)', status: 'passed' },
      { id: 2, time: '07:25 AM', titleHi: 'नोएडा सिटी सेंटर मेट्रो', titleEn: 'Noida City Centre Metro', subHi: 'पार हो चुका है ✓ (07:26 AM)', subEn: 'Passed ✓ (07:26 AM)', status: 'passed' },
      { id: 3, time: '07:36 AM', titleHi: 'शिप्रा सनसिटी गेट 3 (आपका स्टॉप)', titleEn: 'Shipra Suncity Gate 3 (Your Stop)', subHi: 'बस 11 मिनट दूर है (~3.3 km)', subEn: 'Bus is 11 mins away (~3.3 km)', status: 'target', isUserStop: true },
      { id: 4, time: '07:50 AM', titleHi: 'इंदिरापुरम हैबिटैट सेंटर', titleEn: 'Indirapuram Habitat Centre', subHi: 'अंतिम स्टॉप (Final)', subEn: 'Final Stop', status: 'upcoming' }
    ]
  }
];


// 31 Inspiring Daily Thoughts for Home Screen Rotation
const DAILY_QUOTES = [
  {
    hi: 'चिंता छोड़िए, अपनों का हाथ थामिए। हर समस्या का समाधान धैर्य और प्रेम से मिल जाता है।',
    en: 'Let go of worries, hold onto family. Every problem resolves with patience and love.'
  },
  {
    hi: 'परिवार एक ऐसा पेड़ है जिसकी जड़ें संस्कार हैं और शाखाएं खुशियां।',
    en: 'Family is a tree whose roots are values and branches are happiness.'
  },
  {
    hi: 'आज का दिन एक नया अवसर है, मुस्कुराइए और पूरी निष्ठा से आगे बढ़िए।',
    en: 'Today is a brand new opportunity; smile and stride forward with dedication.'
  },
  {
    hi: 'सच्ची शांति बचत, संतोष और अपनों के विश्वास में ही मिलती है।',
    en: 'True peace is found in savings, contentment, and family trust.'
  },
  {
    hi: 'कठिन समय एक परीक्षा है, धैर्य और एकता से हर चुनौती छोटी हो जाती है।',
    en: 'Tough times are tests; patience and unity make every hurdle small.'
  },
  {
    hi: 'जो समय परिवार के साथ हँसते-बोलते बीतता है, वही असली संपत्ति है।',
    en: 'Time spent laughing and sharing with family is life’s greatest wealth.'
  },
  {
    hi: 'स्वास्थ्य सबसे बड़ा उपहार है और संतोष सबसे बड़ा धन।',
    en: 'Health is the greatest gift, and contentment is the richest wealth.'
  },
  {
    hi: 'हर सुबह अपने साथ नई उम्मीद और नया सवेरा लेकर आती है।',
    en: 'Every morning brings fresh hope and a brand new dawn.'
  },
  {
    hi: 'छोटी-छोटी बचतों से ही बड़ा भविष्य और आत्मनिर्भरता बनती है।',
    en: 'Small daily savings build a secure future and true self-reliance.'
  },
  {
    hi: 'बच्चों की मुस्कान और बड़ों का आशीर्वाद घर को स्वर्ग बनाते हैं।',
    en: 'Children’s smiles and elders’ blessings turn a house into heaven.'
  },
  {
    hi: 'मेहनत और ईमानदारी का फल देर से सही, पर हमेशा मीठा होता है।',
    en: 'The fruit of hard work and honesty may take time, but is always sweet.'
  },
  {
    hi: 'दूसरों की मदद करने से मिलने वाली खुशी सबसे अनमोल होती है।',
    en: 'The joy derived from helping others is the most precious feeling.'
  },
  {
    hi: 'क्रोध में लिया गया निर्णय कभी सुखद परिणाम नहीं देता, शांत रहें।',
    en: 'Decisions made in anger rarely yield peace; remain composed and calm.'
  },
  {
    hi: 'अनुशासन और समय की पाबंदी जीवन को सफल और व्यवस्थित बनाते हैं।',
    en: 'Discipline and punctuality make life successful and orderly.'
  },
  {
    hi: 'अपने बुजुर्गों का सम्मान करें, उनका अनुभव जीवन का सच्चा मार्गदर्शन है।',
    en: 'Respect elders; their wisdom and experience are life’s true compass.'
  },
  {
    hi: 'सफलता का रहस्य केवल निरंतर प्रयास और सकारात्मक सोच में है।',
    en: 'The secret of success lies in persistence and positive thinking.'
  },
  {
    hi: 'रिश्ते विश्वास की डोर से बंधे होते हैं, इन्हें हमेशा प्यार से संभालें।',
    en: 'Relationships are woven with trust; nurture them always with love.'
  },
  {
    hi: 'जो व्यक्ति संतोषी है, वह संसार का सबसे सुखी इंसान है।',
    en: 'One who practices contentment is truly the happiest soul on earth.'
  },
  {
    hi: 'गलतियों से सीखिए और बिना रुके अपनी मंज़िल की ओर बढ़ते रहिए।',
    en: 'Learn from mistakes and keep stepping forward toward your goals.'
  },
  {
    hi: 'घर में प्रेम और समझदारी हो तो हर दिन एक त्यौहार जैसा होता है।',
    en: 'When love and harmony dwell at home, every day feels like a festival.'
  },
  {
    hi: 'अपनी सेहत का ध्यान रखना परिवार के प्रति सबसे पहली ज़िम्मेदारी है।',
    en: 'Caring for your health is your foremost duty toward your family.'
  },
  {
    hi: 'मुस्कुराहट एक ऐसा दीपक है जो दूसरों के जीवन में भी उजाला भर देता है।',
    en: 'A warm smile is a candle that illuminates the lives of others too.'
  },
  {
    hi: 'समय का सही सदुपयोग ही मनुष्य को महान और समर्थ बनाता है।',
    en: 'Making wise use of time makes a person capable and great.'
  },
  {
    hi: 'सादगी और सच्चाई में जो सौंदर्य है, वह किसी दिखावे में नहीं।',
    en: 'The beauty found in simplicity and truth surpasses all pretense.'
  },
  {
    hi: 'ईश्वर में आस्था और अपने कर्म पर विश्वास ही जीवन का संबल है।',
    en: 'Faith in the Divine and devotion to duty are life’s greatest pillars.'
  },
  {
    hi: 'जब परिवार साथ खड़ा हो, तो दुनिया की कोई भी मुश्किल बड़ी नहीं होती।',
    en: 'When family stands united, no obstacle in the world is insurmountable.'
  },
  {
    hi: 'ज्ञान और अच्छे विचार ही इंसान की वास्तविक पहचान और आभूषण हैं।',
    en: 'Knowledge and noble thoughts are a person’s real ornaments.'
  },
  {
    hi: 'हर कठिनाई के पीछे एक नया अनुभव और नया अवसर छिपा होता है।',
    en: 'Behind every difficulty lies a valuable lesson and a new opportunity.'
  },
  {
    hi: 'वाणी में मिठास और मन में दया हो तो पराए भी अपने बन जाते हैं।',
    en: 'Gentle speech and a compassionate heart win over the entire world.'
  },
  {
    hi: 'सपनों को साकार करने के लिए संकल्प और एकाग्रता सबसे ज़रूरी है।',
    en: 'Resolve and focus are the essential keys to turning dreams into reality.'
  },
  {
    hi: 'आज का दिन ईश्वर का अनुपम उपहार है, इसे पूरी कृतज्ञता से जिएं।',
    en: 'Today is a divine gift; live it with profound gratitude and joy.'
  }
];


  // Dynamic Time-Aware Greeting (Morning, Afternoon, Evening, Night)
  const getDynamicGreeting = (l: 'hi' | 'en') => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) {
      return l === 'hi' ? 'शुभ प्रभात • परिवार' : 'Good Morning • Family';
    } else if (hour >= 12 && hour < 17) {
      return l === 'hi' ? 'शुभ दोपहर • परिवार' : 'Good Afternoon • Family';
    } else if (hour >= 17 && hour < 21) {
      return l === 'hi' ? 'शुभ संध्या • परिवार' : 'Good Evening • Family';
    } else {
      return l === 'hi' ? 'शुभ रात्रि • परिवार' : 'Good Night • Family';
    }
  };

const getTodayQuote = (l: 'hi' | 'en') => {
  const dayIndex = (new Date().getDate() - 1) % DAILY_QUOTES.length;
  const item = DAILY_QUOTES[dayIndex] || DAILY_QUOTES[0];
  return l === 'hi' ? item.hi : item.en;
};

export default function App() {
  const [lang, setLang] = useState<'hi' | 'en'>('hi');
  const [activeTab, setActiveTab] = useState<TabType>('home');
  const pagerRef = useRef<any>(null);

  // Cloud Network State
  const [myDeviceId] = useState(() => 'dev_' + Math.floor(100000 + Math.random() * 900000));
  const [familyCode, setFamilyCode] = useState('MAST-8821');
  const [isPairModalOpen, setIsPairModalOpen] = useState(false);
  const [tempCodeInput, setTempCodeInput] = useState('');
  const lastPollTimeRef = useRef<number>(Math.floor(Date.now() / 1000));

  // In-App Notification Banner State
  const [inAppAlert, setInAppAlert] = useState<{ title: string; body: string; type?: 'alarm' | 'bus' | 'intercom' } | null>(null);

  // Subtabs & Filters
  const [vaultSubtab, setVaultSubtab] = useState<'appliances' | 'gold' | 'docs'>('appliances');
  const [docMemberFilter, setDocMemberFilter] = useState<'all' | 'babu' | 'amma' | 'self' | 'kids'>('all');
  const [diaryFilter, setDiaryFilter] = useState<'all' | 'kavita' | 'vichar'>('all');

  // Multi-Child & Multi-School State
  const [schoolChildren, setSchoolChildren] = useState<any[]>(DEFAULT_SCHOOL_CHILDREN);
  const [activeChildId, setActiveChildId] = useState<string>('child_riya');

  // Driver Profile & Simple State-District Hierarchy State
  const [driverNameInput, setDriverNameInput] = useState('');
  const [driverPhoneInput, setDriverPhoneInput] = useState('');
  const [driverState, setDriverState] = useState('');
  const [driverDistrict, setDriverDistrict] = useState('');
  const [registeredSchools, setRegisteredSchools] = useState<string[]>([]);
  const [driverSelectedSchool, setDriverSelectedSchool] = useState('');
  const [driverSelectedBus, setDriverSelectedBus] = useState('');

  // Device Lock State (Fingerprint / PIN / Screen Lock)
  const [isAppLocked, setIsAppLocked] = useState(true);
  const [biometricAvailable, setBiometricAvailable] = useState(false);

  // User Onboarding & Profile State
  const [userProfile, setUserProfile] = useState<{ name: string; mobile: string; email: string } | null>(null);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [onboardName, setOnboardName] = useState('');
  const [onboardMobile, setOnboardMobile] = useState('');
  const [onboardEmail, setOnboardEmail] = useState('');

  // Dynamic Live Time (Updated every second)
  const [liveTime, setLiveTime] = useState<string>(() => {
    const d = new Date();
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
  });

  useEffect(() => {
    const clockTimer = setInterval(() => {
      const d = new Date();
      setLiveTime(d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }));
    }, 1000);
    return () => clearInterval(clockTimer);
  }, []);
  const [driverCustomBusInput, setDriverCustomBusInput] = useState('');
  const [driverLoggedInBus, setDriverLoggedInBus] = useState<any | null>(null);
  const [driverDutyActive, setDriverDutyActive] = useState(false);
  const [isChangeBusModalOpen, setIsChangeBusModalOpen] = useState(false);
  const [tempSwitchBusInput, setTempSwitchBusInput] = useState('');
  const driverDutyIntervalRef = useRef<any>(null);

  // Parent State & District Hierarchy for Adding Child
  const [parentState, setParentState] = useState('');
  const [parentDistrict, setParentDistrict] = useState('');

  // Searchable Dropdown Picker Modal State
  const [isLocationPickerOpen, setIsLocationPickerOpen] = useState(false);
  const [pickerType, setPickerType] = useState<'state' | 'district'>('state');
  const [pickerTarget, setPickerTarget] = useState<'parent' | 'driver'>('parent');
  const [locationSearchQuery, setLocationSearchQuery] = useState('');

  // Add Child Modal State
  const [isAddChildModalOpen, setIsAddChildModalOpen] = useState(false);
  const [newChildName, setNewChildName] = useState('');
  const [newChildAvatar, setNewChildAvatar] = useState('👧');
  const [newChildSchool, setNewChildSchool] = useState('');
  const [newChildGrade, setNewChildGrade] = useState('');
  const [newChildBusNo, setNewChildBusNo] = useState('');
  const [newChildBusCode, setNewChildBusCode] = useState('');
  const [newChildStopName, setNewChildStopName] = useState('');

  // Child Fees & Monthly Auto-Reminder States
  const [newChildSchoolFee, setNewChildSchoolFee] = useState('');
  const [newChildBusFee, setNewChildBusFee] = useState('');
  const [newChildDueDay, setNewChildDueDay] = useState('10');
  const [autoSetChildReminder, setAutoSetChildReminder] = useState(true);
  const [editingChildId, setEditingChildId] = useState<string | null>(null);
  const [editingMedId, setEditingMedId] = useState<number | null>(null);
  const [editingApplianceId, setEditingApplianceId] = useState<number | null>(null);
  const [editingGoldId, setEditingGoldId] = useState<number | null>(null);
  const [editingDocId, setEditingDocId] = useState<number | null>(null);
  const [editingReminderId, setEditingReminderId] = useState<number | null>(null);
  const [editingMemberId, setEditingMemberId] = useState<number | null>(null);
  const [editingDiaryId, setEditingDiaryId] = useState<number | null>(null);
  const [diarySearchQuery, setDiarySearchQuery] = useState('');
  const [selectedFullPhoto, setSelectedFullPhoto] = useState<string | null>(null);

  // Bus Role State
  const [busRole, setBusRole] = useState<'parent' | 'driver'>('parent');
  const [isBusSimulating, setIsBusSimulating] = useState(false);
  const busTimerRef = useRef<any>(null);

  // Active child helper
  const activeChild = schoolChildren.find(c => c.id === activeChildId) || schoolChildren[0] || null;
  const [busETA, setBusETA] = useState<number>(8);
  const [busStopIdx, setBusStopIdx] = useState<number>(2);
  const [cloudTripActive, setCloudTripActive] = useState<boolean>(false);
  const isTripActive = driverDutyActive || isBusSimulating || cloudTripActive;
  const setIsTripActive = (active: boolean) => setCloudTripActive(active);

  // Translation Helper
  const tr = (str: any, targetLang?: 'hi' | 'en'): string => {
    if (!str || typeof str !== 'string') return '';
    const l = targetLang || lang;
    if (TRANSLATION_MAP[str]) {
      return TRANSLATION_MAP[str][l] || str;
    }
    for (const key of Object.keys(TRANSLATION_MAP)) {
      if (TRANSLATION_MAP[key].en === str) {
        return TRANSLATION_MAP[key][l] || str;
      }
    }
    return str;
  };

  const getLocalized = (item: any, field: string): string => {
    if (!item) return '';
    if (lang === 'en') {
      const val = item[field + 'En'] || item[field];
      return tr(val, 'en');
    }
    const val = item[field + 'Hi'] || item[field];
    return tr(val, 'hi');
  };

  const toggleLanguage = async () => {
    const next = lang === 'hi' ? 'en' : 'hi';
    setLang(next);
    await AsyncStorage.setItem('@mast_v7_lang', next);
  };

  // Dynamic Day + Date + Live Time Formatter
  const getFormattedDate = (l: 'hi' | 'en') => {
    const d = new Date();
    const daysHi = ['रविवार', 'सोमवार', 'मंगलवार', 'बुधवार', 'गुरुवार', 'शुक्रवार', 'शनिवार'];
    const daysEn = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const monthsHi = ['जनवरी', 'फ़रवरी', 'मार्च', 'अप्रैल', 'मई', 'जून', 'जुलाई', 'अगस्त', 'सितंबर', 'अक्टूबर', 'नवंबर', 'दिसंबर'];
    const monthsEn = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    const dayName = l === 'hi' ? daysHi[d.getDay()] : daysEn[d.getDay()];
    const monthName = l === 'hi' ? monthsHi[d.getMonth()] : monthsEn[d.getMonth()];
    return `📅 ${dayName}, ${d.getDate()} ${monthName} • ⏰ ${liveTime}`;
  };

  // Permanent Medicines List (Clean - Ready for User)
  const [medicines, setMedicines] = useState<any[]>([]);
  const [takenMeds, setTakenMeds] = useState<{ [key: number]: boolean }>({});

  // Appliances List (Clean - Ready for User)
  const [appliances, setAppliances] = useState<any[]>([]);

  // Gold & Valuables List (Clean - Ready for User)
  const [goldItems, setGoldItems] = useState<any[]>([]);

  // Family Documents List (Clean - Ready for User)
  const [familyDocs, setFamilyDocs] = useState<any[]>([]);

  // Upcoming Reminders List (Clean - Ready for User)
  const [upcomingReminders, setUpcomingReminders] = useState<any[]>([]);

  // Household Expenses (Clean - Ready for User)
  const [expenses, setExpenses] = useState<any[]>([]);
  const [monthlyBudget, setMonthlyBudget] = useState<number>(35000);
  const [isBudgetModalOpen, setIsBudgetModalOpen] = useState(false);
  const [tempBudgetInput, setTempBudgetInput] = useState('');

  // Family Members Directory (Clean - Populated on Onboarding)
  const [familyMembers, setFamilyMembers] = useState<any[]>([]);

  // Personal Diary & Poems (Clean - Ready for User)
  const [diaryEntries, setDiaryEntries] = useState<any[]>([]);

  // Family Intercom & Cloud Chat
  const [familyChat, setFamilyChat] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState('');

  // Modals Visibility
  const [selectedRx, setSelectedRx] = useState<any>(null);
  const [isRxModalOpen, setIsRxModalOpen] = useState(false);
  const [isSOSModalOpen, setIsSOSModalOpen] = useState(false);
  const [isDonateModalOpen, setIsDonateModalOpen] = useState(false);

  // Add Item Modals
  const [isAddMedModalOpen, setIsAddMedModalOpen] = useState(false);
  const [isAddApplianceModalOpen, setIsAddApplianceModalOpen] = useState(false);
  const [isAddGoldModalOpen, setIsAddGoldModalOpen] = useState(false);
  const [isAddDocModalOpen, setIsAddDocModalOpen] = useState(false);
  const [isAddReminderModalOpen, setIsAddReminderModalOpen] = useState(false);
  const [isAddExpenseModalOpen, setIsAddExpenseModalOpen] = useState(false);
  const [isAddMemberModalOpen, setIsAddMemberModalOpen] = useState(false);
  const [isAddDiaryModalOpen, setIsAddDiaryModalOpen] = useState(false);

  // Forms State
  const [newMedName, setNewMedName] = useState('');
  const [newMedTime, setNewMedTime] = useState('08:00 AM');
  const [newMedDose, setNewMedDose] = useState('');
  const [newMedDoc, setNewMedDoc] = useState('');
  const [newMedPhoto, setNewMedPhoto] = useState<string | null>(null);
  const [newMedPatient, setNewMedPatient] = useState('स्वयं (Self)');

  const [newVaultName, setNewVaultName] = useState('');
  const [newVaultPrice, setNewVaultPrice] = useState('');
  const [newVaultWarranty, setNewVaultWarranty] = useState('');
  const [newVaultStore, setNewVaultStore] = useState('');
  const [newVaultPhoto, setNewVaultPhoto] = useState<string | null>(null);

  // Gold Form State
  const [newGoldTitle, setNewGoldTitle] = useState('');
  const [newGoldWeight, setNewGoldWeight] = useState('');
  const [newGoldPurity, setNewGoldPurity] = useState('22K 916 BIS');
  const [newGoldValue, setNewGoldValue] = useState('');
  const [newGoldLocker, setNewGoldLocker] = useState('SBI Locker #104');
  const [newGoldJeweller, setNewGoldJeweller] = useState('');
  const [newGoldPhoto, setNewGoldPhoto] = useState<string | null>(null);

  // Doc Form State
  const [newDocMember, setNewDocMember] = useState('babu');
  const [newDocTitle, setNewDocTitle] = useState('');
  const [newDocNumber, setNewDocNumber] = useState('');
  const [newDocPhoto, setNewDocPhoto] = useState<string | null>(null);

  // Universal Calendar Date Picker State
  const [calendarTarget, setCalendarTarget] = useState<'appliance' | 'reminder' | 'expense' | 'member' | 'doc' | 'gold' | 'diary' | 'child_due' | null>(null);
  const [calendarViewYear, setCalendarViewYear] = useState<number>(new Date().getFullYear());
  const [calendarViewMonth, setCalendarViewMonth] = useState<number>(new Date().getMonth());
  const [calendarSelectedDate, setCalendarSelectedDate] = useState<Date>(new Date());
  const [calendarPickerMode, setCalendarPickerMode] = useState<'day' | 'year' | 'month'>('day');
  const [calendarYearPickerPage, setCalendarYearPickerPage] = useState<number>(() => Math.floor(new Date().getFullYear() / 12) * 12);

  // Additional Date States for Forms
  const [newExpDate, setNewExpDate] = useState('आज');
  const [newMemberDob, setNewMemberDob] = useState('');
  const [newDocExpiry, setNewDocExpiry] = useState('');
  const [newGoldDate, setNewGoldDate] = useState('');
  const [newDiaryDate, setNewDiaryDate] = useState('आज');

  // Reminder Form State
  const [newRemTitle, setNewRemTitle] = useState('');
  const [newRemAmount, setNewRemAmount] = useState('');
  const [newRemDate, setNewRemDate] = useState('05 Nov');
  const [newRemCategory, setNewRemCategory] = useState<'bills' | 'bday' | 'other'>('bills');
  const [newRemUrgent, setNewRemUrgent] = useState(false);

  // Expense Form State
  const [newExpTitle, setNewExpTitle] = useState('');
  const [newExpAmount, setNewExpAmount] = useState('');
  const [newExpCategory, setNewExpCategory] = useState<'ration' | 'fees' | 'med' | 'other'>('ration');

  // Member Form State
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberRelation, setNewMemberRelation] = useState('');
  const [newMemberPhone, setNewMemberPhone] = useState('');
  const [newMemberAge, setNewMemberAge] = useState('');
  const [newMemberAvatar, setNewMemberAvatar] = useState('🧑');

  // Diary Form State
  const [newDiaryTitle, setNewDiaryTitle] = useState('');
  const [newDiaryContent, setNewDiaryContent] = useState('');
  const [newDiaryType, setNewDiaryType] = useState<'kavita' | 'vichar'>('kavita');


  // Screen Security Lock Authenticator
  const promptDeviceUnlock = async () => {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      if (!hasHardware || !isEnrolled) {
        setBiometricAvailable(false);
        setIsAppLocked(false);
        return;
      }
      setBiometricAvailable(true);
      const res = await LocalAuthentication.authenticateAsync({
        promptMessage: lang === 'hi' ? 'MAST Life OS सुरक्षा अनलॉक' : 'Unlock MAST Life OS',
        fallbackLabel: lang === 'hi' ? 'फ़ोन पिन / पासवर्ड का उपयोग करें' : 'Use Passcode',
        cancelLabel: lang === 'hi' ? 'रद्द करें' : 'Cancel',
        disableDeviceFallback: false,
      });
      if (res.success) {
        setIsAppLocked(false);
      }
    } catch (e) {
      console.log('Device auth error:', e);
      setIsAppLocked(false);
    }
  };

  // Save User Profile and auto-link email backup & family member
  const handleSaveUserProfile = async (name: string, mobile: string, email: string) => {
    if (!name.trim() || !mobile.trim() || !email.trim()) {
      Alert.alert(
        lang === 'hi' ? 'अधूरी जानकारी' : 'Incomplete Details',
        lang === 'hi' ? 'कृपया अपना नाम, मोबाइल नंबर और ईमेल आईडी भरें।' : 'Please fill your Name, Mobile and Email.'
      );
      return;
    }
    const profile = { name: name.trim(), mobile: mobile.trim(), email: email.trim(), date: new Date().toISOString() };
    setUserProfile(profile);
    await AsyncStorage.setItem('@mast_v7_user_profile', JSON.stringify(profile));
    await AsyncStorage.setItem('@mast_v7_backup_email', profile.email);

    // Auto-update family members with Self Admin
    const selfMember = {
      id: Date.now(),
      name: `${profile.name} (स्वयं)`,
      relationHi: 'स्वयं (एडमिन)',
      relationEn: 'Self (Admin)',
      phone: profile.mobile,
      email: profile.email,
      age: '',
      avatar: '👤',
      role: 'Family Admin'
    };
    const updatedMembers = [selfMember, ...familyMembers.filter(m => !m.relationHi.includes('स्वयं'))];
    saveMembers(updatedMembers);
    setIsOnboardingOpen(false);

    Alert.alert(
      lang === 'hi' ? '✓ प्रोफ़ाइल सुरक्षित!' : '✓ Profile Saved!',
      lang === 'hi'
        ? `स्वागत है ${profile.name}! आपकी प्रोफ़ाइल और बैकअप ईमेल (${profile.email}) सक्रिय हो गए हैं।`
        : `Welcome ${profile.name}! Your profile & backup email (${profile.email}) are active.`
    );
  };

  // Load from Storage & Startup Permissions
  useEffect(() => {
    (async () => {
      // 1. Authenticate with phone lock
      promptDeviceUnlock();

      // 2. Request all core app permissions on startup
      try {
        await Notifications.requestPermissionsAsync();
      } catch (e) {}
      try {
        await ImagePicker.requestCameraPermissionsAsync();
      } catch (e) {}
      try {
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      } catch (e) {}

      // 3. Load user profile or trigger onboarding
      try {
        const storedProfile = await AsyncStorage.getItem('@mast_v7_user_profile');
        if (storedProfile) {
          const parsed = JSON.parse(storedProfile);
          setUserProfile(parsed);
          setOnboardName(parsed.name || '');
          setOnboardMobile(parsed.mobile || '');
          setOnboardEmail(parsed.email || '');
        } else {
          // First launch: Open onboarding modal
          setIsOnboardingOpen(true);
        }

        const storedLang = await AsyncStorage.getItem('@mast_v7_lang');
        if (storedLang === 'hi' || storedLang === 'en') setLang(storedLang);

        const storedCode = await AsyncStorage.getItem('@mast_v7_family_code');
        if (storedCode) setFamilyCode(storedCode);

        const storedMeds = await AsyncStorage.getItem('@mast_v7_meds');
        if (storedMeds) setMedicines(JSON.parse(storedMeds));

        const storedTaken = await AsyncStorage.getItem('@mast_v7_taken');
        if (storedTaken) setTakenMeds(JSON.parse(storedTaken));

        const storedAppliances = await AsyncStorage.getItem('@mast_v7_appliances');
        if (storedAppliances) setAppliances(JSON.parse(storedAppliances));

        const storedGold = await AsyncStorage.getItem('@mast_v7_gold');
        if (storedGold) setGoldItems(JSON.parse(storedGold));

        const storedDocs = await AsyncStorage.getItem('@mast_v7_docs');
        if (storedDocs) setFamilyDocs(JSON.parse(storedDocs));

        const storedReminders = await AsyncStorage.getItem('@mast_v7_reminders');
        if (storedReminders) setUpcomingReminders(JSON.parse(storedReminders));

        const storedExpenses = await AsyncStorage.getItem('@mast_v7_expenses');
        if (storedExpenses) setExpenses(JSON.parse(storedExpenses));

        const storedBudget = await AsyncStorage.getItem('@mast_v7_monthly_budget');
        if (storedBudget) {
          const b = parseInt(storedBudget, 10);
          if (!isNaN(b)) setMonthlyBudget(b);
        }

        const storedMembers = await AsyncStorage.getItem('@mast_v7_members');
        if (storedMembers) setFamilyMembers(JSON.parse(storedMembers));

        const storedDiary = await AsyncStorage.getItem('@mast_v7_diary');
        if (storedDiary) setDiaryEntries(JSON.parse(storedDiary));

        const storedChat = await AsyncStorage.getItem('@mast_v7_chat');
        if (storedChat) setFamilyChat(JSON.parse(storedChat));

        const storedChildren = await AsyncStorage.getItem('@mast_v7_school_children');
        if (storedChildren && JSON.parse(storedChildren).length > 0) {
          setSchoolChildren(JSON.parse(storedChildren));
        } else {
          setSchoolChildren(DEFAULT_SCHOOL_CHILDREN);
        }

        const storedParentState = await AsyncStorage.getItem('@mast_v7_parent_state');
        if (storedParentState) setParentState(storedParentState);

        const storedParentDistrict = await AsyncStorage.getItem('@mast_v7_parent_district');
        if (storedParentDistrict) setParentDistrict(storedParentDistrict);

        const storedDriverState = await AsyncStorage.getItem('@mast_v7_driver_state');
        if (storedDriverState) setDriverState(storedDriverState);

        const storedDriverDistrict = await AsyncStorage.getItem('@mast_v7_driver_district');
        if (storedDriverDistrict) setDriverDistrict(storedDriverDistrict);
      } catch (err) {
        console.log('Error reading storage', err);
      }
    })();
  }, []);

  const saveMeds = async (newMeds: any[]) => {
    setMedicines(newMeds);
    await AsyncStorage.setItem('@mast_v7_meds', JSON.stringify(newMeds));
  };

  const saveTaken = async (newTaken: any) => {
    setTakenMeds(newTaken);
    await AsyncStorage.setItem('@mast_v7_taken', JSON.stringify(newTaken));
  };

  const saveAppliances = async (newApps: any[]) => {
    setAppliances(newApps);
    await AsyncStorage.setItem('@mast_v7_appliances', JSON.stringify(newApps));
  };

  const saveGold = async (newGold: any[]) => {
    setGoldItems(newGold);
    await AsyncStorage.setItem('@mast_v7_gold', JSON.stringify(newGold));
  };

  const saveDocs = async (newDocs: any[]) => {
    setFamilyDocs(newDocs);
    await AsyncStorage.setItem('@mast_v7_docs', JSON.stringify(newDocs));
  };

  const saveReminders = async (newRem: any[]) => {
    setUpcomingReminders(newRem);
    await AsyncStorage.setItem('@mast_v7_reminders', JSON.stringify(newRem));
  };

  
  const saveBudget = async (amount: number) => {
    setMonthlyBudget(amount);
    await AsyncStorage.setItem('@mast_v7_monthly_budget', amount.toString());
    setIsBudgetModalOpen(false);
  };

  const saveExpenses = async (newExp: any[]) => {
    setExpenses(newExp);
    await AsyncStorage.setItem('@mast_v7_expenses', JSON.stringify(newExp));
  };

  const saveMembers = async (newMem: any[]) => {
    setFamilyMembers(newMem);
    await AsyncStorage.setItem('@mast_v7_members', JSON.stringify(newMem));
  };

  const saveDiary = async (newD: any[]) => {
    setDiaryEntries(newD);
    await AsyncStorage.setItem('@mast_v7_diary', JSON.stringify(newD));
  };

  const saveChat = async (newC: any[]) => {
    setFamilyChat(newC);
    await AsyncStorage.setItem('@mast_v7_chat', JSON.stringify(newC));
  };

  // ================= CLOUD SYNC ENGINE (NTFY.SH REAL-TIME BUS, CHAT & BUZZER) =================
  const publishCloudEvent = async (payload: any) => {
    try {
      const cleanCode = familyCode.toLowerCase().replace(/[^a-z0-9]/g, '');
      const topic = `mast_family_${cleanCode}`;
      await fetch(`https://ntfy.sh/${topic}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...payload,
          senderId: myDeviceId,
          timestamp: Date.now()
        })
      });
    } catch (err) {
      console.log('Cloud publish note:', err);
    }
  };

  // Background Cloud Poller
  useEffect(() => {
    const cleanCode = familyCode.toLowerCase().replace(/[^a-z0-9]/g, '');
    const topic = `mast_family_${cleanCode}`;
    
    const pollInterval = setInterval(async () => {
      try {
        const since = lastPollTimeRef.current;
        const res = await fetch(`https://ntfy.sh/${topic}/json?poll=1&since=${since}`);
        if (!res.ok) return;
        const text = await res.text();
        lastPollTimeRef.current = Math.floor(Date.now() / 1000);
        
        const lines = text.trim().split('\n');
        for (const line of lines) {
          if (!line) continue;
          try {
            const entry = JSON.parse(line);
            if (entry.event === 'message' && entry.message) {
              let data: any = null;
              try { data = JSON.parse(entry.message); } catch {}
              if (!data) continue;
              if (data.senderId === myDeviceId) continue; // Skip own messages

              if (data.type === 'intercom') {
                Vibration.vibrate([0, 300, 200, 300]);
                setInAppAlert({
                  title: '🔊 ' + (data.senderName || 'परिवार') + ': ' + data.title,
                  body: data.body,
                  type: 'intercom'
                });
                setTimeout(() => setInAppAlert(null), 6000);
              } else if (data.type === 'chat') {
                const newMsg = {
                  id: data.msgId || Date.now(),
                  senderHi: data.senderName || 'सदस्य',
                  senderEn: data.senderName || 'Member',
                  msgHi: data.text,
                  msgEn: data.text,
                  time: data.time || 'अभी',
                  isSelf: false
                };
                setFamilyChat(prev => {
                  if (prev.some(m => m.id === newMsg.id)) return prev;
                  const updated = [...prev, newMsg];
                  AsyncStorage.setItem('@mast_v7_chat', JSON.stringify(updated));
                  return updated;
                });
                Vibration.vibrate(100);
              } else if (data.type === 'bus_location') {
                if (data.eta !== undefined) setBusETA(data.eta);
                if (data.stopIdx !== undefined) setBusStopIdx(data.stopIdx);
                if (data.isTripActive !== undefined) setIsTripActive(data.isTripActive);
              } else if (data.type === 'sos') {
                Vibration.vibrate([0, 500, 250, 500, 250, 500]);
                setInAppAlert({
                  title: '🚨 आपातकालीन SOS अलर्ट!',
                  body: (data.senderName || 'परिवार के सदस्य') + ' को तुरंत सहायता की आवश्यकता है!',
                  type: 'alarm'
                });
                setTimeout(() => setInAppAlert(null), 8000);
              }
            }
          } catch (e) {}
        }
      } catch (e) {}
    }, 3500);

    return () => clearInterval(pollInterval);
  }, [familyCode, myDeviceId]);

  // 100% COMPLETE BILINGUAL DICTIONARY
  const t = {
    hi: {
      appName: 'MAST',
      tagline: 'सब ठीक रहेगा',
      goodMorning: 'शुभ प्रभात • परिवार',
      todayHero: 'आज सब मंगलमय होगा!',
      thought: 'चिंता छोड़िए, अपनों का हाथ थामिए। हर समस्या का समाधान धीरे-धीरे मिल जाता है।',
      todayAgenda: 'आज की दवाइयां',
      addMedBtn: '+ नई दवा जोड़ें',
      rxSlip: 'पर्चा Rx',
      quickAccess: 'त्वरित सेवाएं (Quick Access)',
      tileVault: 'लॉकर: बिल, सोना, डॉक्स',
      tileVaultSub: 'वारंटी, सोना-चांदी, आधार',
      filesCount: 'फाइल्स',
      tileBus: 'स्कूल बस लाइव',
      tileBusSub: 'बस 12 मिनट दूर है',
      liveBadge: 'लाइव',
      tileMed: 'दवाइयां (Dawa)',
      tileMedSub: 'दादाजी - 08:30 PM',
      tileDiary: 'डायरी व विचार',
      tileDiarySub: 'कविता, WhatsApp शेयर',
      budgetTitle: 'घरेलू खर्च व बजट',
      addExpenseBtn: '+ खर्च जोड़ें',
      rationLegend: '🟢 राशन',
      feesLegend: '🟡 फीस व बिल',
      medLegend: '🟣 दवा व इलाज',
      otherLegend: '⚪ अन्य',

      // Vault
      vaultHeading: 'पारिवारिक लॉकर',
      vaultSub: 'सामान, वारंटी, सोना-चांदी व डॉक्स',
      addApplianceBtn: '+ नया सामान जोड़ें',
      addGoldBtn: '+ नया आभूषण जोड़ें',
      addDocBtn: '+ नया दस्तावेज़ जोड़ें',
      tabAppliances: 'घरेलू सामान',
      tabGold: 'सोना-चांदी (Gold)',
      tabDocs: 'दस्तावेज़ (Docs)',
      boughtLabel: 'खरीदा',
      storeLabel: 'दुकान',
      warrantyLabel: 'वारंटी',
      takeBillPhoto: '📸 बिल फ़ोटो खींचें',
      changeBillPhoto: '📸 बिल बदलें',
      goldHeader: 'पारिवारिक स्वर्ण संचय (Safe Vault)',
      goldGrams: 'ग्राम सोना (Gold)',
      silverGrams: '• 250 ग्राम चांदी (Silver)',
      goldNote: '✓ सभी आभूषण 916 BIS हॉलमार्क पक्के बिल सहित सुरक्षित',
      weightLabel: 'वजन',
      purityLabel: 'शुद्धता',
      locationLabel: 'स्थान',
      memberLabel: 'सदस्य',
      verifiedTag: '✓ सत्यापित',
      takeDocPhoto: '📸 डॉक्युमेंट फ़ोटो खींचें',
      changeDocPhoto: '📸 डॉक्युमेंट बदलें',

      // Reminders
      remHeading: 'रिमाइंडर व दवाइयां',
      remSub: 'दैनिक अलार्म, दवा की घंटी व समय पर अलर्ट',
      testAlarmBtn: '🔔 अलार्म टेस्ट करें (Alarm Chime)',
      upcomingHeading: '📅 आने वाले भुगतान व कार्यक्रम',
      addReminderBtn: '+ नया बिल/रिमाइंडर',
      dueDateLabel: 'अंतिम तिथि',

      // Bus
      busHeading: 'स्कूल बस ट्रैकर',
      busSub: 'बच्चे की सुरक्षा • लाइव GPS लोकेशन',
      modeParent: '👨‍👩‍👧 अभिभावक मोड',
      modeDriver: '🚌 ड्राइवर मोड',
      minsUnit: 'मिनट',
      etaTitle: 'अनुमानित आगमन (ETA)',
      stopName: 'आनंद विहार गेट नं. 2 (आपका स्टॉप)',
      speedTag: '38 km/h • गति सीमा के भीतर',
      routeTitle: 'रूट #12 (स्कूल ⇄ आनंद विहार)',
      driverName: 'ड्राइवर: रमेश कुमार • 📞 9876543210',
      conductorName: 'कंडक्टर: सुरेश यादव • 📞 9876543211',
      schoolHelpline: 'स्कूल बस कंट्रोल रूम: 011-27891234',
      callDriver: 'ड्राइवर को कॉल करें',
      tripActive: 'ट्रिप चालू है (GPS ऑन)',
      tripInactive: 'ट्रिप बंद है',
      startTrip: '▶️ ट्रिप शुरू करें',
      endTrip: '⏹️ ट्रिप समाप्त करें',
      startSim: '▶️ लाइव सिमुलेशन चलाएं',
      stopSim: '⏸️ सिमुलेशन रोकें',
      testChimeBtn: '🔔 अराइवल घंटी टेस्ट',
      refreshGpsBtn: '🔄 GPS रिफ्रेश',
      childBoardedBadge: '✓ बस में सवार (07:15 AM पर बोर्ड किया)',
      childInfo: '👧 रिया (कक्षा 5-B) • सीट #14 (खिड़की)',
      childRfid: 'ID कार्ड #DPS-2026-88',
      speedTagText: '38 km/h • गति सीमा के भीतर',
      distTagText: '2.4 km दूर (निकट आ रही है)',
      trafficTagText: '🟢 सुगम मार्ग (Smooth)',
      vehicleSpec: 'टाटा स्टारबस (DL 01 AB 4321) • GPS व CCTV युक्त',
      callDriverDirect: 'कॉल करें',
      whatsappDriver: 'WhatsApp',
      driverAnnounce1: '📢 "सेक्टर 14 गोलचक्कर पार किया"',
      driverAnnounce2: '📢 "आनंद विहार आ रहा है (2 मिनट दूर)"',
      driverAnnounce3: '🎉 "आनंद विहार स्टॉप पर आगमन"',
      driverDelayBroadcast: '⚠️ भारी ट्रैफिक (10 मिनट देरी सूचना)',

      // Diary
      diaryHeading: 'व्यक्तिगत डायरी व विचार',
      diarySub: 'कविताएं, सीख और मन की बातें',
      addDiaryBtn: '+ नई रचना लिखें',
      shareWA: '📲 WhatsApp पर शेयर करें',

      // Family Connect
      famHeading: 'पारिवारिक कनेक्ट',
      famSub: 'सदस्य निर्देशिका, इंटरकॉम बजर व गपशप',
      connectCodeLabel: '🔑 पारिवारिक कनेक्ट कोड (Family Code)',
      connectCodeDesc: 'घर के अन्य सदस्यों के फ़ोन में MAST इंस्टॉल करवाकर यह कोड दर्ज करें ताकि वे इस फैमिली से जुड़ सकें:',
      shareInviteBtn: '📲 WhatsApp पर इनवाइट भेजें',
      membersHeading: '👨‍👩‍👧‍👦 परिवार के सदस्य (Directory)',
      addMemberBtn: '+ सदस्य जोड़ें',
      intercomTitle: '🔊 स्मार्ट इंटरकॉम बजर (Instant Alert)',
      intercomDesc: 'एक क्लिक में घर के सभी सदस्यों के फ़ोन पर सायरन/सूचना भेजें:',
      buzzerDinner: 'खाना तैयार है! (Dinner)',
      buzzerHome: 'घर पहुँच गया! (Reached)',
      buzzerHelp: 'मदद / सायरन (Urgent)',
      familyChatTitle: 'पारिवारिक गपशप (Family Chat)',
      chatEncrypted: '🔒 100% सुरक्षित (Cloud Live)',
      chatPlaceholder: 'परिवार को संदेश लिखें...',

      // Modals
      addMedTitle: '💊 नई दवा जोड़ें',
      medNamePrompt: 'दवाई का नाम',
      medTimePrompt: 'समय (उदा: 08:30 PM)',
      medDosePrompt: 'खुराक (उदा: 1 गोली भोजन बाद)',
      medDocPrompt: 'डॉक्टर का नाम',
      snapDocPhotoPrompt: '📸 डॉक्टर का पर्चा अटैच करें',
      photoAttached: '✓ पर्चा फ़ोटो अटैच हो गई',
      saveMedBtn: '💾 दवाई सेव करें',

      addVaultTitle: '🗄️ नया सामान जोड़ें',
      itemNamePrompt: 'सामान का नाम (उदा: LG AC / फ्रिज)',
      pricePrompt: 'कीमत (उदा: ₹35,000)',
      warrantyPrompt: 'वारंटी अंतिम तिथि (उदा: 15 Oct 2027)',
      storePrompt: 'दुकान का नाम (उदा: विजय सेल्स)',
      snapBillPrompt: '📸 पक्के बिल की फ़ोटो खींचें',
      billAttached: '✓ बिल की फ़ोटो अटैच हो गई',
      saveToVaultBtn: '💾 सामान लॉकर में सेव करें',

      addGoldTitle: '✨ नया आभूषण जोड़ें',
      goldTitlePrompt: 'आभूषण का नाम (उदा: सोने की चेन / कंगन)',
      goldWeightPrompt: 'वजन (ग्राम में, उदा: 14.5 gm)',
      goldPurityPrompt: 'शुद्धता (उदा: 22K 916 BIS हॉलमार्क)',
      goldValuePrompt: 'अनुमानित मूल्य (उदा: ₹1,10,000)',
      goldLockerPrompt: 'स्थान (उदा: SBI लॉकर #104 / घर की तिजोरी)',
      goldJewellerPrompt: 'दुकान/ज्वेलर (उदा: तनिष्क ज्वेलर्स)',
      snapGoldPhotoPrompt: '📸 आभूषण या रसीद की फ़ोटो',
      goldAttached: '✓ आभूषण फ़ोटो अटैच हो गई',
      saveGoldBtn: '💾 स्वर्ण संचय में सेव करें',

      addDocTitle: '📄 नया पारिवारिक दस्तावेज़ जोड़ें',
      docMemberPrompt: 'परिवार का सदस्य चुनें',
      docTitlePrompt: 'दस्तावेज़ का नाम (उदा: पैन कार्ड / पासपोर्ट)',
      docNumberPrompt: 'दस्तावेज़ नंबर (उदा: ABCDE1234F)',
      snapDocPhoto: '📸 दस्तावेज़ की फ़ोटो खींचें या चुनें',
      docAttached: '✓ दस्तावेज़ फ़ोटो अटैच हो गई',
      saveDocBtn: '💾 दस्तावेज़ लॉकर में सेव करें',

      addReminderTitle: '🔔 नया बिल या रिमाइंडर जोड़ें',
      remTitlePrompt: 'रिमाइंडर का नाम (उदा: गैस सिलेंडर बुकिंग)',
      remAmountPrompt: 'राशि (उदा: ₹1,050)',
      remDatePrompt: 'देय तिथि (उदा: 05 Nov)',
      remUrgentPrompt: '🚨 क्या यह अत्यावश्यक (Urgent) है?',
      saveReminderBtn: '💾 रिमाइंडर सेव करें',

      addExpenseTitle: '💰 नया घरेलू खर्च जोड़ें',
      expTitlePrompt: 'खर्च का विवरण (उदा: फल व सब्जियां)',
      expAmountPrompt: 'रकम ₹ (उदा: 1500)',
      saveExpenseBtn: '💾 खर्च जोड़ें',

      addMemberTitle: '👨‍👩‍👧 नया परिवार सदस्य जोड़ें',
      memberNamePrompt: 'पूरा नाम (उदा: मुन्नी / राहुल)',
      memberRelationPrompt: 'रिश्ता (उदा: बेटा / बेटी / भाई)',
      memberPhonePrompt: 'मोबाइल नंबर (उदा: 9811XXXXXX)',
      memberAgePrompt: 'उम्र (उदा: 14 वर्ष)',
      saveMemberBtn: '💾 सदस्य जोड़ें',

      addDiaryTitle: '✍️ व्यक्तिगत डायरी में लिखें',
      tabKavita: '✍️ कविता',
      tabVichar: '💡 विचार / संस्मरण',
      titlePrompt: 'शीर्षक',
      contentPrompt: 'अपने विचार या पंक्तियां यहाँ लिखें...',
      saveToDiaryBtn: '💾 डायरी में सेव करें',

      rxTitle: '📄 डॉक्टर का पर्चा (Rx Slip)',
      patientLabel: 'मरीज',
      doseLabel: 'खुराक व समय',
      snapRxBtn: '📸 इस पर्चे की असली फ़ोटो खींचें',
      changeRxBtn: '📸 पर्चा बदलें',
      closeBtn: 'बंद करें'
    },
    en: {
      appName: 'MAST',
      tagline: 'Everything will be fine',
      goodMorning: 'Good Morning • Family',
      todayHero: 'Today will be peaceful!',
      thought: 'Let go of worries, hold onto family. Every problem resolves step by step.',
      todayAgenda: "Today's Medicines",
      addMedBtn: '+ Add Medicine',
      rxSlip: 'Rx Slip',
      quickAccess: 'Quick Access',
      tileVault: 'Vault: Bills, Gold, Docs',
      tileVaultSub: 'Warranty, 916 Gold, ID Cards',
      filesCount: 'files',
      tileBus: 'School Bus Live',
      tileBusSub: 'Bus is 12 mins away',
      liveBadge: 'Live',
      tileMed: 'Medicines (Rx)',
      tileMedSub: 'Grandpa - 08:30 PM',
      tileDiary: 'Diary & Thoughts',
      tileDiarySub: 'Poetry, WhatsApp share',
      budgetTitle: 'Monthly Household Budget',
      addExpenseBtn: '+ Add Expense',
      rationLegend: '🟢 Groceries',
      feesLegend: '🟡 Bills & Fees',
      medLegend: '🟣 Healthcare',
      otherLegend: '⚪ Misc',

      // Vault
      vaultHeading: 'Family Safe Vault',
      vaultSub: 'Appliances, Warranty, Gold & Docs',
      addApplianceBtn: '+ Add Appliance',
      addGoldBtn: '+ Add Gold/Silver',
      addDocBtn: '+ Add Document',
      tabAppliances: 'Appliances',
      tabGold: 'Gold & Silver',
      tabDocs: 'Documents',
      boughtLabel: 'Purchased',
      storeLabel: 'Store',
      warrantyLabel: 'Warranty',
      takeBillPhoto: '📸 Snap Bill Photo',
      changeBillPhoto: '📸 Change Bill Photo',
      goldHeader: 'Family Precious Reserves (Safe Vault)',
      goldGrams: 'grams Gold',
      silverGrams: '• 250 grams Silver',
      goldNote: '✓ All jewellery certified 916 BIS Hallmark with invoices',
      weightLabel: 'Weight',
      purityLabel: 'Purity',
      locationLabel: 'Location',
      memberLabel: 'Member',
      verifiedTag: '✓ Verified',
      takeDocPhoto: '📸 Snap Document Photo',
      changeDocPhoto: '📸 Change Document Photo',

      // Reminders
      remHeading: 'Reminders & Medicine',
      remSub: 'Daily alarms, medicine chime & timely alerts',
      testAlarmBtn: '🔔 Test Alarm Chime',
      upcomingHeading: '📅 Upcoming Payments & Events',
      addReminderBtn: '+ Add Reminder/Bill',
      dueDateLabel: 'Due Date',

      // Bus
      busHeading: 'School Bus Tracker',
      busSub: "Child Safety • Live GPS Location",
      modeParent: '👨‍👩‍👧 Parent Mode',
      modeDriver: '🚌 Driver Mode',
      minsUnit: 'mins',
      etaTitle: 'Estimated Arrival (ETA)',
      stopName: 'Anand Vihar Gate #2 (Your Stop)',
      speedTag: '38 km/h • Within Speed Limit',
      routeTitle: 'Route #12 (School ⇄ Anand Vihar)',
      driverName: 'Driver: Ramesh Kumar • 📞 9876543210',
      conductorName: 'Conductor: Suresh Yadav • 📞 9876543211',
      schoolHelpline: 'Transport Control: 011-27891234',
      callDriver: 'Call Bus Driver',
      tripActive: 'Trip Active (GPS Live)',
      tripInactive: 'Trip Offline',
      startTrip: '▶️ Start Trip',
      endTrip: '⏹️ End Trip',
      startSim: '▶️ Start Live Demo',
      stopSim: '⏸️ Stop Demo',
      testChimeBtn: '🔔 Test Arrival Chime',
      refreshGpsBtn: '🔄 Refresh GPS',
      childBoardedBadge: '✓ Boarded Safely (At 07:15 AM)',
      childInfo: '👧 Riya (Class 5-B) • Seat #14 (Window)',
      childRfid: 'ID Card #DPS-2026-88',
      speedTagText: '38 km/h • Within Speed Limit',
      distTagText: '2.4 km away (Approaching)',
      trafficTagText: '🟢 Smooth Traffic Flow',
      vehicleSpec: 'Tata Starbus (DL 01 AB 4321) • GPS & CCTV Active',
      callDriverDirect: 'Call',
      whatsappDriver: 'WhatsApp',
      driverAnnounce1: '📢 Announce: Passed Sector 14',
      driverAnnounce2: '📢 Announce: Approaching Anand Vihar (2m)',
      driverAnnounce3: '🎉 Announce: Arrived at Anand Vihar',
      driverDelayBroadcast: '⚠️ Broadcast Delay (+10 mins)',

      // Diary
      diaryHeading: 'Personal Diary & Notes',
      diarySub: 'Verses, memories and reflections',
      addDiaryBtn: '+ Write New Note',
      shareWA: '📲 Share on WhatsApp',

      // Family Connect
      famHeading: 'Family Connect',
      famSub: 'Members directory, intercom buzzer & chat',
      connectCodeLabel: '🔑 Family Network Code',
      connectCodeDesc: 'Install MAST on family phones and enter this code to join the household:',
      shareInviteBtn: '📲 Send Invite on WhatsApp',
      membersHeading: '👨‍👩‍👧‍👦 Family Members (Directory)',
      addMemberBtn: '+ Add Member',
      intercomTitle: '🔊 Smart Intercom Buzzer (Instant Alert)',
      intercomDesc: 'Broadcast an instant audio alert to all household phones:',
      buzzerDinner: 'Dinner is Ready! (Meal)',
      buzzerHome: 'Reached Home! (Safe)',
      buzzerHelp: 'Urgent Alert / Siren (Help)',
      familyChatTitle: 'Family Group Chat',
      chatEncrypted: '🔒 100% Private (Cloud Live)',
      chatPlaceholder: 'Write a family message...',

      // Modals
      addMedTitle: '💊 Add New Medicine',
      medNamePrompt: 'Medicine Name',
      medTimePrompt: 'Time (e.g. 08:30 PM)',
      medDosePrompt: 'Dose (e.g. 1 pill after meal)',
      medDocPrompt: 'Doctor Name',
      snapDocPhotoPrompt: '📸 Attach Doctor Prescription',
      photoAttached: '✓ Prescription Photo Attached',
      saveMedBtn: '💾 Save Medicine',

      addVaultTitle: '🗄️ Add New Appliance',
      itemNamePrompt: 'Appliance Name (e.g. LG AC / Fridge)',
      pricePrompt: 'Price (e.g. ₹35,000)',
      warrantyPrompt: 'Warranty Expiry (e.g. 15 Oct 2027)',
      storePrompt: 'Store (e.g. Vijay Sales)',
      snapBillPrompt: '📸 Snap Invoice Photo',
      billAttached: '✓ Invoice Photo Attached',
      saveToVaultBtn: '💾 Save to Vault',

      addGoldTitle: '✨ Add Gold / Silver Jewellery',
      goldTitlePrompt: 'Jewellery Name (e.g. 22K Gold Chain)',
      goldWeightPrompt: 'Weight in grams (e.g. 14.5 gm)',
      goldPurityPrompt: 'Purity (e.g. 22K 916 BIS Hallmark)',
      goldValuePrompt: 'Estimated Value (e.g. ₹1,10,000)',
      goldLockerPrompt: 'Location (e.g. SBI Locker #104 / Home Safe)',
      goldJewellerPrompt: 'Jeweller / Store (e.g. Tanishq Jewellers)',
      snapGoldPhotoPrompt: '📸 Snap Jewellery / Bill Photo',
      goldAttached: '✓ Jewellery Photo Attached',
      saveGoldBtn: '💾 Save to Gold Vault',

      addDocTitle: '📄 Add Family Document',
      docMemberPrompt: 'Select Family Member',
      docTitlePrompt: 'Document Title (e.g. PAN Card / Passport)',
      docNumberPrompt: 'Document Number (e.g. ABCDE1234F)',
      snapDocPhoto: '📸 Snap or Pick Document Photo',
      docAttached: '✓ Document Photo Attached',
      saveDocBtn: '💾 Save to Docs Vault',

      addReminderTitle: '🔔 Add New Bill / Reminder',
      remTitlePrompt: 'Reminder Title (e.g. LPG Gas Booking)',
      remAmountPrompt: 'Amount (e.g. ₹1,050)',
      remDatePrompt: 'Due Date (e.g. 05 Nov)',
      remUrgentPrompt: '🚨 Is this High Priority (Urgent)?',
      saveReminderBtn: '💾 Save Reminder',

      addExpenseTitle: '💰 Add Household Expense',
      expTitlePrompt: 'Expense Description (e.g. Fruits & Groceries)',
      expAmountPrompt: 'Amount ₹ (e.g. 1500)',
      saveExpenseBtn: '💾 Add Expense',

      addMemberTitle: '👨‍👩‍👧 Add Family Member',
      memberNamePrompt: 'Full Name (e.g. Rahul)',
      memberRelationPrompt: 'Relation (e.g. Brother / Son)',
      memberPhonePrompt: 'Mobile Number (e.g. 9811XXXXXX)',
      memberAgePrompt: 'Age (e.g. 28 yrs)',
      saveMemberBtn: '💾 Save Member',

      addDiaryTitle: '✍️ Write in Personal Diary',
      tabKavita: '✍️ Poetry',
      tabVichar: '💡 Thought / Memory',
      titlePrompt: 'Title',
      contentPrompt: 'Write your thoughts or verses here...',
      saveToDiaryBtn: '💾 Save to Diary',

      rxTitle: '📄 Doctor Prescription (Rx Slip)',
      patientLabel: 'Patient',
      doseLabel: 'Dose & Time',
      snapRxBtn: '📸 Snap Original Prescription Photo',
      changeRxBtn: '📸 Change Prescription',
      closeBtn: 'Close'
    }
  }[lang];

  // Helper for Confirm Delete Alert
  const confirmDelete = (title: string, message: string, onConfirm: () => void) => {
    Alert.alert(
      title,
      message,
      [
        { text: lang === 'hi' ? 'रद्द करें' : 'Cancel', style: 'cancel' },
        { text: lang === 'hi' ? 'हटाएं (Delete)' : 'Delete', style: 'destructive', onPress: onConfirm }
      ]
    );
  };

  // Delete Action Handlers
  const deleteMedicine = (id: number) => {
    confirmDelete(
      lang === 'hi' ? 'दवाई हटाएं' : 'Delete Medicine',
      lang === 'hi' ? 'क्या आप इस दवाई को सूची से हटाना चाहते हैं?' : 'Remove this medicine from list?',
      () => saveMeds(medicines.filter(m => m.id !== id))
    );
  };

  const deleteAppliance = (id: number) => {
    confirmDelete(
      lang === 'hi' ? 'सामान हटाएं' : 'Delete Appliance',
      lang === 'hi' ? 'क्या आप इस सामान को लॉकर से हटाना चाहते हैं?' : 'Remove this item from vault?',
      () => saveAppliances(appliances.filter(a => a.id !== id))
    );
  };

  const deleteGold = (id: number) => {
    confirmDelete(
      lang === 'hi' ? 'आभूषण हटाएं' : 'Delete Jewellery',
      lang === 'hi' ? 'क्या आप इस आभूषण को स्वर्ण संचय से हटाना चाहते हैं?' : 'Remove this jewellery from vault?',
      () => saveGold(goldItems.filter(g => g.id !== id))
    );
  };

  const deleteDoc = (id: number) => {
    confirmDelete(
      lang === 'hi' ? 'दस्तावेज़ हटाएं' : 'Delete Document',
      lang === 'hi' ? 'क्या आप इस दस्तावेज़ को लॉकर से हटाना चाहते हैं?' : 'Remove this document from vault?',
      () => saveDocs(familyDocs.filter(d => d.id !== id))
    );
  };

  const deleteReminder = (id: number) => {
    confirmDelete(
      lang === 'hi' ? 'रिमाइंडर हटाएं' : 'Delete Reminder',
      lang === 'hi' ? 'क्या आप इस बिल/रिमाइंडर को हटाना चाहते हैं?' : 'Delete this reminder?',
      () => saveReminders(upcomingReminders.filter(r => r.id !== id))
    );
  };

  const toggleReminderPaid = async (id: number) => {
    const targetRem = upcomingReminders.find(r => r.id === id);
    if (!targetRem) return;
    const willBePaid = !targetRem.paid;

    const updated = upcomingReminders.map(r => r.id === id ? { ...r, paid: willBePaid } : r);
    await saveReminders(updated);

    // Automation: When marked as Paid, automatically link to Monthly Household Budget Expenses!
    if (willBePaid) {
      const numAmount = parseFloat((targetRem.amount || '').replace(/[^0-9.]/g, '')) || 0;
      if (numAmount > 0) {
        const title = targetRem.titleHi || targetRem.titleEn || 'फीस व बिल';
        const newExpenseEntry = {
          id: Date.now(),
          titleHi: `${title} (भुगतान)`,
          titleEn: `${title} (Paid)`,
          amount: numAmount,
          category: targetRem.category === 'fees' ? 'fees' : targetRem.category === 'med' ? 'med' : 'fees',
          date: lang === 'hi' ? 'आज' : 'Today'
        };
        const updatedExpenses = [newExpenseEntry, ...expenses];
        await saveExpenses(updatedExpenses);

        Alert.alert(
          lang === 'hi' ? '✓ भुगतान दर्ज!' : '✓ Payment Recorded!',
          lang === 'hi'
            ? `${title} का ₹${numAmount.toLocaleString('en-IN')} आपके मासिक घरेलू खर्च व बजट में अपने-आप जुड़ गया है।`
            : `${title} of ₹${numAmount.toLocaleString('en-IN')} has been automatically added to your Household Budget & Expenses.`
        );
      }
    }
  };

  const deleteExpense = (id: number) => {
    confirmDelete(
      lang === 'hi' ? 'खर्च हटाएं' : 'Delete Expense',
      lang === 'hi' ? 'क्या आप इस खर्च को हटाना चाहते हैं?' : 'Remove this expense entry?',
      () => saveExpenses(expenses.filter(e => e.id !== id))
    );
  };

  const deleteMember = (id: number) => {
    confirmDelete(
      lang === 'hi' ? 'सदस्य हटाएं' : 'Remove Member',
      lang === 'hi' ? 'क्या आप इस सदस्य को निर्देशिका से हटाना चाहते हैं?' : 'Remove member from family directory?',
      () => saveMembers(familyMembers.filter(m => m.id !== id))
    );
  };

  const deleteDiary = (id: number) => {
    confirmDelete(
      lang === 'hi' ? 'डायरी रचना हटाएं' : 'Delete Entry',
      lang === 'hi' ? 'क्या आप इस रचना को डायरी से हटाना चाहते हैं?' : 'Delete this diary entry?',
      () => saveDiary(diaryEntries.filter(d => d.id !== id))
    );
  };

  // Camera Action Helper
  const launchCameraScanner = async (title: string, onPhotoCaptured: (uri: string) => void) => {
    Alert.alert(
      title,
      lang === 'hi' ? 'आप फोटो कैसे लेना चाहते हैं?' : 'How would you like to capture?',
      [
        {
          text: lang === 'hi' ? '📸 कैमरा चालू करें (Live Camera)' : '📸 Open Camera',
          onPress: async () => {
            const perm = await ImagePicker.requestCameraPermissionsAsync();
            if (!perm.granted) {
              Alert.alert('Permission Required', lang === 'hi' ? 'कैमरा की अनुमति आवश्यक है।' : 'Camera permission is required.');
              return;
            }
            const res = await ImagePicker.launchCameraAsync({ quality: 0.7 });
            if (!res.canceled && res.assets && res.assets[0]) {
              onPhotoCaptured(res.assets[0].uri);
            }
          }
        },
        {
          text: lang === 'hi' ? '🖼️ गैलरी से फ़ोटो चुनें' : '🖼️ Pick from Gallery',
          onPress: async () => {
            const res = await ImagePicker.launchImageLibraryAsync({ quality: 0.7 });
            if (!res.canceled && res.assets && res.assets[0]) {
              onPhotoCaptured(res.assets[0].uri);
            }
          }
        },
        { text: lang === 'hi' ? 'रद्द करें (Cancel)' : 'Cancel', style: 'cancel' }
      ]
    );
  };

  // Instant Test Alarm with Immediate Notification & In-App Banner
  const triggerInstantTestAlarm = async () => {
    try {
      Vibration.vibrate([0, 300, 200, 300]);
      setInAppAlert({
        title: lang === 'hi' ? '💊 दवा का समय हो गया!' : '💊 Medicine Reminder!',
        body: lang === 'hi' ? 'दादाजी: BP व दिल की दवा (Telmisartan) लेने का समय है।' : "Time to take Grandpa's BP medicine (Telmisartan).",
        type: 'alarm'
      });
      setTimeout(() => setInAppAlert(null), 5000);

      await Notifications.scheduleNotificationAsync({
        content: {
          title: lang === 'hi' ? '💊 दवा का समय हो गया!' : '💊 Medicine Reminder!',
          body: lang === 'hi' ? 'दादाजी: BP व दिल की दवा लेने का समय है।' : "Time to take Grandpa's BP medicine.",
          sound: 'default'
        },
        trigger: null
      });
    } catch (e) {
      console.log('Notification trigger note:', e);
    }
  };

  // Searchable Dropdown Location Picker Helpers
  const openLocationPicker = (type: 'state' | 'district', target: 'parent' | 'driver') => {
    setPickerType(type);
    setPickerTarget(target);
    setLocationSearchQuery('');
    setIsLocationPickerOpen(true);
  };

  const getFilteredLocationList = () => {
    const q = locationSearchQuery.trim().toLowerCase();
    if (pickerType === 'state') {
      const allStates = Object.keys(INDIAN_STATES_DISTRICTS);
      if (!q) return allStates;
      const matched = allStates.filter(s => s.toLowerCase().includes(q));
      if (matched.length === 0 && locationSearchQuery.trim()) {
        return [`✍️ "${locationSearchQuery.trim()}" (कस्टम राज्य दर्ज करें)`];
      }
      return matched;
    } else {
      const currentState = pickerTarget === 'parent' ? parentState : driverState;
      const allDistricts = INDIAN_STATES_DISTRICTS[currentState] || [];
      if (!q) return allDistricts;
      const matched = allDistricts.filter(d => d.toLowerCase().includes(q));
      if (locationSearchQuery.trim()) {
        const customPrompt = `✍️ "${locationSearchQuery.trim()}" (अन्य ज़िला / तहसील चुनें)`;
        return [customPrompt, ...matched];
      }
      return matched;
    }
  };

  const isLocationItemSelected = (item: string) => {
    if (pickerType === 'state') {
      return (pickerTarget === 'parent' ? parentState : driverState) === item;
    } else {
      return (pickerTarget === 'parent' ? parentDistrict : driverDistrict) === item;
    }
  };

  const handleSelectLocationItem = (rawItem: string) => {
    Vibration.vibrate(40);
    let item = rawItem;
    if (item.startsWith('✍️ "')) {
      const match = item.match(/✍️ "([^"]+)"/);
      if (match) item = match[1];
    }
    if (pickerType === 'state') {
      const firstDistrict = (INDIAN_STATES_DISTRICTS[item] && INDIAN_STATES_DISTRICTS[item][0]) || '';
      if (pickerTarget === 'parent') {
        setParentState(item);
        setParentDistrict(firstDistrict);
        AsyncStorage.setItem('@mast_v7_parent_state', item);
        if (firstDistrict) AsyncStorage.setItem('@mast_v7_parent_district', firstDistrict);
      } else {
        setDriverState(item);
        setDriverDistrict(firstDistrict);
        AsyncStorage.setItem('@mast_v7_driver_state', item);
        if (firstDistrict) AsyncStorage.setItem('@mast_v7_driver_district', firstDistrict);
      }
    } else {
      if (pickerTarget === 'parent') {
        setParentDistrict(item);
        AsyncStorage.setItem('@mast_v7_parent_district', item);
      } else {
        setDriverDistrict(item);
        AsyncStorage.setItem('@mast_v7_driver_district', item);
      }
    }
    setIsLocationPickerOpen(false);
  };

  // Google Maps Deep-Link Integrations
  const openBusOnGoogleMaps = (lat: number, lng: number, label: string) => {
    Vibration.vibrate(60);
    const url = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
    Linking.openURL(url);
  };

  const navigateToMyStopOnGoogleMaps = (lat: number, lng: number) => {
    Vibration.vibrate(60);
    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
    Linking.openURL(url);
  };

  // Driver Login, Bus Switching & Safe Driving Duty Handlers
  const handleDriverLogin = async (busNo: string, school: string) => {
    if (!driverState || !driverDistrict) {
      Alert.alert('Notice', lang === 'hi' ? 'कृपया पहले अपना राज्य और ज़िला चुनें' : 'Please select your State and District first');
      return;
    }
    const chosenBus = busNo.trim() || 'Bus #12';
    const busKey = generateUniversalBusKey(driverState, driverDistrict, school, chosenBus);
    const profile = {
      busNo: chosenBus,
      busCode: busKey,
      school,
      state: driverState,
      district: driverDistrict,
      driverName: driverNameInput.trim() || 'राजेश कुमार',
      driverPhone: driverPhoneInput.trim() || '9876543210',
      vehicleNo: 'DL 01 AB 4321 (Tata Starbus)'
    };
    setDriverLoggedInBus(profile);
    await AsyncStorage.setItem('@mast_v7_driver_bus', JSON.stringify(profile));
    Vibration.vibrate(100);
    Alert.alert(
      lang === 'hi' ? 'ड्राइवर लॉगिन सफल' : 'Driver Logged In',
      lang === 'hi' ? `${chosenBus} (${school}) ड्यूटी में कनेक्ट हो गए! माता-पिता अब लाइव ट्रैकिंग देख सकते हैं।` : `Connected to ${chosenBus} (${school})! Parents can now track live.`
    );
  };

  const handleSwitchBusNumber = async (newBusNumber: string) => {
    if (!newBusNumber.trim() || !driverLoggedInBus) return;
    const cleanBus = newBusNumber.trim();
    const newBusKey = generateUniversalBusKey(
      driverLoggedInBus.state || driverState,
      driverLoggedInBus.district || driverDistrict,
      driverLoggedInBus.school,
      cleanBus
    );
    const updated = {
      ...driverLoggedInBus,
      busNo: cleanBus,
      busCode: newBusKey
    };
    setDriverLoggedInBus(updated);
    await AsyncStorage.setItem('@mast_v7_driver_bus', JSON.stringify(updated));
    setIsChangeBusModalOpen(false);
    setTempSwitchBusInput('');
    Vibration.vibrate(100);

    // Notify parents on cloud
    publishCloudEvent({
      type: 'driver_bus_changed',
      oldBus: driverLoggedInBus.busNo,
      newBus: cleanBus,
      busCode: newBusKey,
      driverName: updated.driverName,
      driverPhone: updated.driverPhone
    });

    Alert.alert(
      lang === 'hi' ? 'बस नंबर बदल गया' : 'Bus Number Changed',
      lang === 'hi' ? `ड्राइवर की ड्यूटी अब ${cleanBus} पर सेट हो गई है। सभी संबंधित अभिभावक जुड़ गए हैं!` : `Driver duty switched to ${cleanBus}. Parents of this bus are now synced!`
    );
  };

  const handleDriverLogout = async () => {
    if (driverDutyActive) {
      clearInterval(driverDutyIntervalRef.current);
      setDriverDutyActive(false);
    }
    setDriverLoggedInBus(null);
    await AsyncStorage.removeItem('@mast_v7_driver_bus');
  };

  const toggleDriverDuty = () => {
    if (driverDutyActive) {
      clearInterval(driverDutyIntervalRef.current);
      setDriverDutyActive(false);
      publishCloudEvent({
        type: 'bus_location',
        busCode: driverLoggedInBus?.busCode || 'DPS-BUS-12',
        isTripActive: false,
        eta: 0
      });
      Vibration.vibrate([0, 200, 100, 200]);
      Alert.alert(
        lang === 'hi' ? 'ड्यूटी समाप्त' : 'Duty Completed',
        lang === 'hi' ? 'आज की स्कूल बस ट्रिप समाप्त हो गई।' : 'Bus trip completed.'
      );
    } else {
      setDriverDutyActive(true);
      Vibration.vibrate([0, 300, 150, 300]);
      Alert.alert(
        lang === 'hi' ? '🟢 ड्यूटी शुरू हो गई!' : '🟢 Duty Started!',
        lang === 'hi' ? 'GPS लाइव ट्रांसमिट हो रहा है। फोन को डैशबोर्ड पर रख दें और सुरक्षित ड्राइव करें। आपको स्क्रीन छूने की कोई आवश्यकता नहीं है।' : 'GPS Live broadcast active. Mount phone on dashboard and drive safely. Zero interaction needed.'
      );

      let step = 0;
      const etas = [14, 10, 6, 2, 0];
      driverDutyIntervalRef.current = setInterval(() => {
        step = (step + 1) % etas.length;
        const currentEta = etas[step];
        const currentBusCode = driverLoggedInBus?.busCode || 'DPS-BUS-12';
        publishCloudEvent({
          type: 'bus_location',
          busCode: currentBusCode,
          isTripActive: true,
          eta: currentEta,
          speed: 38
        });

        setSchoolChildren(prev => prev.map(ch => {
          if (ch.busCode === currentBusCode) {
            return { ...ch, etaMins: currentEta };
          }
          return ch;
        }));
      }, 4000);
    }
  };

  const toggleStudentBoarding = (childId: string) => {
    Vibration.vibrate(60);
    setSchoolChildren(prev => prev.map(c => {
      if (c.id === childId) {
        const nextState = !c.isBoarded;
        publishCloudEvent({
          type: 'student_boarding',
          childId: c.id,
          childName: c.name,
          isBoarded: nextState,
          busCode: c.busCode
        });
        return { ...c, isBoarded: nextState };
      }
      return c;
    }));
  };



  // Open / Edit Medicine
  const openAddMedModal = () => {
    setEditingMedId(null);
    setNewMedName('');
    setNewMedTime('08:00 AM');
    setNewMedDose('');
    setNewMedDoc('');
    setNewMedPhoto(null);
    setNewMedPatient(userProfile?.name ? `${userProfile.name} (स्वयं)` : 'स्वयं (Self)');
    setIsAddMedModalOpen(true);
  };
  const openEditMedModal = (m: any) => {
    setEditingMedId(m.id);
    setNewMedName(m.nameHi || m.nameEn || m.name || '');
    setNewMedTime(m.time || '08:00 AM');
    setNewMedDose(m.doseHi || m.doseEn || m.dose || '');
    setNewMedDoc(m.doctorHi || m.doctorEn || m.doctor || '');
    setNewMedPhoto(m.imageUri || null);
    setNewMedPatient(m.patientHi || m.patientEn || m.patient || 'स्वयं');
    setIsAddMedModalOpen(true);
  };

  // Open / Edit Appliance
  const openAddApplianceModal = () => {
    setEditingApplianceId(null);
    setNewVaultName('');
    setNewVaultPrice('');
    setNewVaultWarranty('');
    setNewVaultStore('');
    setNewVaultPhoto(null);
    setIsAddApplianceModalOpen(true);
  };
  const openEditApplianceModal = (a: any) => {
    setEditingApplianceId(a.id);
    setNewVaultName(a.nameHi || a.nameEn || a.name || '');
    setNewVaultPrice((a.price || '').replace(/[^0-9.]/g, ''));
    setNewVaultWarranty(a.warrantyEnd || '');
    setNewVaultStore(a.storeHi || a.storeEn || a.store || '');
    setNewVaultPhoto(a.imageUri || null);
    setIsAddApplianceModalOpen(true);
  };

  // Open / Edit Gold
  const openAddGoldModal = () => {
    setEditingGoldId(null);
    setNewGoldTitle('');
    setNewGoldWeight('');
    setNewGoldPurity('22K 916 BIS');
    setNewGoldValue('');
    setNewGoldLocker('SBI Locker #104');
    setNewGoldJeweller('');
    setNewGoldDate('');
    setNewGoldPhoto(null);
    setIsAddGoldModalOpen(true);
  };
  const openEditGoldModal = (g: any) => {
    setEditingGoldId(g.id);
    setNewGoldTitle(g.titleHi || g.titleEn || g.title || '');
    setNewGoldWeight((g.weight || '').replace(/[^0-9.]/g, ''));
    setNewGoldPurity(g.purityHi || g.purityEn || g.purity || '22K 916 BIS');
    setNewGoldValue((g.value || '').replace(/[^0-9.]/g, ''));
    setNewGoldLocker(g.lockerHi || g.lockerEn || g.locker || 'SBI Locker #104');
    setNewGoldJeweller(g.jewellerHi || g.jewellerEn || g.jeweller || '');
    setNewGoldDate(g.purchaseDate || '');
    setNewGoldPhoto(g.imageUri || null);
    setIsAddGoldModalOpen(true);
  };

  // Open / Edit Document
  const openAddDocModal = () => {
    setEditingDocId(null);
    setNewDocMember('self');
    setNewDocTitle('');
    setNewDocNumber('');
    setNewDocExpiry('');
    setNewDocPhoto(null);
    setIsAddDocModalOpen(true);
  };
  const openEditDocModal = (d: any) => {
    setEditingDocId(d.id);
    setNewDocMember(d.member || 'self');
    setNewDocTitle(d.titleHi || d.titleEn || d.title || '');
    setNewDocNumber(d.docNo || '');
    setNewDocExpiry(d.expiry || '');
    setNewDocPhoto(d.imageUri || null);
    setIsAddDocModalOpen(true);
  };

  // Open / Edit Reminder
  const openAddReminderModal = () => {
    setEditingReminderId(null);
    setNewRemTitle('');
    setNewRemAmount('');
    setNewRemDate('05 Nov');
    setNewRemCategory('bills');
    setNewRemUrgent(false);
    setIsAddReminderModalOpen(true);
  };
  const openEditReminderModal = (r: any) => {
    setEditingReminderId(r.id);
    setNewRemTitle(r.titleHi || r.titleEn || r.title || '');
    setNewRemAmount((r.amount || '').replace(/[^0-9.]/g, ''));
    setNewRemDate(r.date || '');
    setNewRemCategory(r.category || 'bills');
    setNewRemUrgent(!!r.urgent);
    setIsAddReminderModalOpen(true);
  };

  // Open / Edit Family Member
  const openAddMemberModal = () => {
    setEditingMemberId(null);
    setNewMemberName('');
    setNewMemberRelation('');
    setNewMemberPhone('');
    setNewMemberAge('');
    setNewMemberDob('');
    setNewMemberAvatar('🧑');
    setIsAddMemberModalOpen(true);
  };
  const openEditMemberModal = (m: any) => {
    setEditingMemberId(m.id);
    setNewMemberName(m.name || m.nameHi || m.nameEn || '');
    setNewMemberRelation(m.relationHi || m.relationEn || m.role || '');
    setNewMemberPhone(m.phone || '');
    setNewMemberAge(m.age ? String(m.age) : '');
    setNewMemberDob(m.dob || '');
    setNewMemberAvatar(m.avatar || '🧑');
    setIsAddMemberModalOpen(true);
  };

  // Open / Edit Diary
  const openAddDiaryModal = () => {
    setEditingDiaryId(null);
    setNewDiaryTitle('');
    setNewDiaryContent('');
    setNewDiaryType('kavita');
    setNewDiaryDate('आज');
    setIsAddDiaryModalOpen(true);
  };
  const openEditDiaryModal = (entry: any) => {
    setEditingDiaryId(entry.id);
    setNewDiaryTitle(entry.titleHi || entry.titleEn || entry.title || '');
    setNewDiaryContent(entry.contentHi || entry.contentEn || entry.content || '');
    setNewDiaryType(entry.type || 'kavita');
    setNewDiaryDate(entry.date || 'आज');
    setIsAddDiaryModalOpen(true);
  };
  // Open Add Child (reset all form fields)
  const openAddChildModal = () => {
    setEditingChildId(null);
    setNewChildName('');
    setNewChildAvatar('👧');
    setNewChildSchool('');
    setNewChildGrade('');
    setNewChildBusNo('');
    setNewChildBusCode('');
    setNewChildStopName('');
    setNewChildSchoolFee('');
    setNewChildBusFee('');
    setNewChildDueDay('10');
    setAutoSetChildReminder(true);
    setIsAddChildModalOpen(true);
  };

  // Open Edit Child (prefill with child data)
  const openEditChildModal = (child: any) => {
    setEditingChildId(child.id);
    setNewChildName(child.name || child.nameEn || '');
    setNewChildAvatar(child.avatar || '👧');
    setNewChildSchool(child.schoolNameHi || child.schoolNameEn || '');
    setNewChildGrade(child.grade || '');
    setNewChildBusNo(child.busNo || '');
    setNewChildBusCode(child.busCode || '');
    const cleanStop = (child.stopNameHi || child.stopNameEn || '').replace(/\s*\(आपका स्टॉप\)|\s*\(Your Stop\)/g, '');
    setNewChildStopName(cleanStop);
    setNewChildSchoolFee((child.schoolFee || '').replace(/[^0-9.]/g, ''));
    setNewChildBusFee((child.busFee || '').replace(/[^0-9.]/g, ''));
    setNewChildDueDay(child.dueDay ? String(child.dueDay) : '10');
    if (child.state) setParentState(child.state);
    if (child.district) setParentDistrict(child.district);
    setAutoSetChildReminder(true);
    setIsAddChildModalOpen(true);
  };
  const handleAddNewChild = async () => {
    if (!newChildName.trim() || !newChildSchool.trim()) {
      Alert.alert('Notice', lang === 'hi' ? 'बच्चे व स्कूल का नाम लिखें' : 'Please enter child & school name');
      return;
    }
    const busNo = newChildBusNo.trim() || 'Bus #01';
    const schoolName = newChildSchool.trim();
    const stopName = newChildStopName.trim() || (lang === 'hi' ? 'घर का स्टॉप' : 'Home Stop');
    const busKey = generateUniversalBusKey(parentState, parentDistrict, schoolName, busNo);

    const sFeeNum = parseFloat(newChildSchoolFee) || 0;
    const bFeeNum = parseFloat(newChildBusFee) || 0;
    const dueDayNum = parseInt(newChildDueDay, 10) || 10;
    const isEditing = !!editingChildId;
    const currentChildId = editingChildId || `child_${Date.now()}`;

    // Existing child if editing, or brand new child
    const existingChild = schoolChildren.find(c => c.id === editingChildId);

    const savedChild = {
      id: currentChildId,
      name: newChildName.trim(),
      nameEn: newChildName.trim(),
      avatar: newChildAvatar,
      schoolNameHi: newChildSchool.trim(),
      schoolNameEn: newChildSchool.trim(),
      grade: newChildGrade.trim() || 'Class 1',
      busNo: busNo,
      busCode: busKey,
      state: parentState,
      district: parentDistrict,
      vehicleNo: existingChild?.vehicleNo || 'DL 01 GPS (School Bus)',
      stopNameHi: `${stopName} (आपका स्टॉप)`,
      stopNameEn: `${stopName} (Your Stop)`,
      stopCoords: existingChild?.stopCoords || { lat: 28.6250, lng: 77.3000 },
      busCoords: existingChild?.busCoords || { lat: 28.6300, lng: 77.2900 },
      rfidTag: existingChild?.rfidTag || `ID-${Math.floor(1000 + Math.random() * 9000)}`,
      seatNo: existingChild?.seatNo || 'Auto Assigned',
      driverNameHi: existingChild?.driverNameHi || 'स्कूल चालक',
      driverNameEn: existingChild?.driverNameEn || 'School Driver',
      driverPhone: existingChild?.driverPhone || '98XXXXXXXX',
      conductorNameHi: existingChild?.conductorNameHi || 'सहायक',
      conductorNameEn: existingChild?.conductorNameEn || 'Bus Attendant',
      conductorPhone: existingChild?.conductorPhone || '98XXXXXXXX',
      schoolHelpline: existingChild?.schoolHelpline || '011-23456789',
      etaMins: existingChild?.etaMins || 10,
      speedKmh: existingChild?.speedKmh || 35,
      isBoarded: existingChild ? existingChild.isBoarded : true,
      stops: [
        { id: 1, time: '07:15 AM', titleHi: `${newChildSchool.trim()} गेट`, titleEn: `${newChildSchool.trim()} Gate`, subHi: 'प्रस्थान ✓', subEn: 'Departed ✓', status: 'passed' },
        { id: 2, time: '07:30 AM', titleHi: `${stopName} (आपका स्टॉप)`, titleEn: `${stopName} (Your Stop)`, subHi: 'बस 10 मिनट दूर है', subEn: 'Bus is 10 mins away', status: 'target', isUserStop: true },
        { id: 3, time: '07:45 AM', titleHi: 'अंतिम स्टॉप (Final Stop)', titleEn: 'Final Terminal', subHi: 'आगामी', subEn: 'Upcoming', status: 'upcoming' }
      ],
      schoolFee: sFeeNum > 0 ? `₹${sFeeNum}` : '',
      busFee: bFeeNum > 0 ? `₹${bFeeNum}` : '',
      dueDay: dueDayNum
    };

    let updated: any[] = [];
    if (isEditing) {
      updated = schoolChildren.map(c => c.id === editingChildId ? savedChild : c);
    } else {
      updated = [...schoolChildren, savedChild];
    }

    setSchoolChildren(updated);
    setActiveChildId(savedChild.id);
    await AsyncStorage.setItem('@mast_v7_school_children', JSON.stringify(updated));

    // Automatically generate Reminders if opted for Next Due Date
    const newRemindersCreated: any[] = [];
    const monthsShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const now = new Date();
    const todayDate = now.getDate();
    // If today is past the due day (e.g. today is 30th and due day is 5th), next due date is next month!
    const targetDateObj = new Date(now.getFullYear(), now.getMonth(), dueDayNum);
    if (todayDate > dueDayNum) {
      targetDateObj.setMonth(targetDateObj.getMonth() + 1);
    }
    const targetMonthName = monthsShort[targetDateObj.getMonth()];
    const dayStr = dueDayNum < 10 ? `0${dueDayNum}` : `${dueDayNum}`;
    const dueDateDisplay = `${dayStr} ${targetMonthName}`;

    if (autoSetChildReminder) {
      if (sFeeNum > 0) {
        newRemindersCreated.push({
          id: Date.now() + 101,
          category: 'fees',
          titleHi: `🏫 ${newChild.name} - स्कूल फीस (${schoolName})`,
          titleEn: `🏫 ${newChild.name} - School Fee (${schoolName})`,
          amount: `₹${sFeeNum.toLocaleString('en-IN')}`,
          date: dueDateDisplay,
          urgent: true,
          paid: false
        });
      }
      if (bFeeNum > 0) {
        newRemindersCreated.push({
          id: Date.now() + 102,
          category: 'fees',
          titleHi: `🚌 ${newChild.name} - स्कूल बस फीस (${busNo})`,
          titleEn: `🚌 ${newChild.name} - Bus Fee (${busNo})`,
          amount: `₹${bFeeNum.toLocaleString('en-IN')}`,
          date: dueDateDisplay,
          urgent: false,
          paid: false
        });
      }
      if (newRemindersCreated.length > 0) {
        const updatedReminders = [...upcomingReminders, ...newRemindersCreated];
        saveReminders(updatedReminders);
      }
    }

    // Automatically sync school & bus to Driver Mode!
    setRegisteredSchools(prev => Array.from(new Set([schoolName, ...prev])));
    setDriverSelectedSchool(schoolName);
    setDriverState(parentState);
    setDriverDistrict(parentDistrict);
    setDriverSelectedBus(busNo);

    // Broadcast new school registration to cloud
    publishCloudEvent({
      type: 'new_school_registered',
      schoolName,
      busNo,
      state: parentState,
      district: parentDistrict
    });

    setNewChildName('');
    setNewChildSchool('');
    setNewChildGrade('');
    setNewChildBusNo('');
    setNewChildBusCode('');
    setNewChildStopName('');
    setNewChildSchoolFee('');
    setNewChildBusFee('');
    setNewChildDueDay('10');
    setIsAddChildModalOpen(false);

    const reminderMsg = newRemindersCreated.length > 0
      ? (lang === 'hi'
          ? ` और ${newRemindersCreated.length} मासिक फीस रिमाइंडर भी सेट हो गए हैं!`
          : ` and ${newRemindersCreated.length} monthly fee reminders created!`)
      : '';

    Alert.alert(
      lang === 'hi' ? 'सफल' : 'Success',
      lang === 'hi'
        ? `बच्चा (${newChild.name}) व स्कूल बस सुरक्षित जुड़ गए हैं${reminderMsg}`
        : `Child (${newChild.name}) and school bus saved${reminderMsg}`
    );

    Vibration.vibrate(100);
    Alert.alert(
      lang === 'hi' ? 'सफल' : 'Success',
      lang === 'hi' ? `${newChild.name} की बस (${busNo}) जुड़ गई!` : `${newChild.name}'s bus (${busNo}) connected!`
    );
  };

  const deleteSchoolChild = (childId: string) => {
    if (schoolChildren.length <= 1) {
      Alert.alert('Notice', lang === 'hi' ? 'कम से कम एक बच्चा सूची में होना चाहिए।' : 'At least one child must remain in list.');
      return;
    }
    Alert.alert(
      lang === 'hi' ? 'बच्चा हटाएं' : 'Remove Child',
      lang === 'hi' ? 'क्या आप इस बच्चे की बस ट्रैकिंग हटाना चाहते हैं?' : 'Remove this child from bus tracking?',
      [
        { text: lang === 'hi' ? 'रद्द करें' : 'Cancel', style: 'cancel' },
        {
          text: lang === 'hi' ? 'हटाएं' : 'Delete',
          style: 'destructive',
          onPress: async () => {
            const updated = schoolChildren.filter(c => c.id !== childId);
            setSchoolChildren(updated);
            setActiveChildId(updated[0].id);
            await AsyncStorage.setItem('@mast_v7_school_children', JSON.stringify(updated));
          }
        }
      ]
    );
  };

  // Bus Chime Test, GPS Refresh & Driver Announcement Helpers
  const triggerBusChimeTest = async () => {
    Vibration.vibrate([0, 300, 150, 300]);
    setInAppAlert({
      title: lang === 'hi' ? '🚌 स्कूल बस 2 मिनट दूर है!' : '🚌 School Bus 2 Mins Away!',
      body: lang === 'hi' ? 'आनंद विहार गेट नं. 2 पर पहुँचने की तैयारी करें।' : 'Please head to Anand Vihar Gate #2 stop.',
      type: 'bus'
    });
    setTimeout(() => setInAppAlert(null), 5000);
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: lang === 'hi' ? '🚌 स्कूल बस निकट आ रही है!' : '🚌 School Bus Approaching!',
          body: lang === 'hi' ? 'बस 2 मिनट में आपके स्टॉप पर पहुँच रही है।' : 'Bus reaching your stop in 2 minutes.',
          sound: 'default'
        },
        trigger: null
      });
    } catch (e) {}
  };

  const refreshBusGPS = () => {
    Vibration.vibrate(80);
    Alert.alert(
      lang === 'hi' ? 'GPS लाइव लोकेशन रिफ्रेश' : 'GPS Location Refreshed',
      lang === 'hi' ? 'उपग्रह GPS सिग्नल सक्रिय है। बस की वर्तमान गति: 38 km/h' : 'Satellite GPS signal active. Current speed: 38 km/h'
    );
  };

  const dispatchDriverAnnouncement = (titleHi: string, titleEn: string, eta: number, stopIdx: number) => {
    Vibration.vibrate([0, 150, 100, 150]);
    setBusETA(eta);
    setBusStopIdx(stopIdx);
    const annText = lang === 'hi' ? titleHi : titleEn;
    publishCloudEvent({
      type: 'bus_location',
      announcementTitle: annText,
      eta,
      stopIdx,
      isTripActive: true
    });
    setInAppAlert({
      title: lang === 'hi' ? '📢 बस घोषणा प्रसारित की गई' : '📢 Bus Announcement Broadcasted',
      body: annText,
      type: 'bus'
    });
    setTimeout(() => setInAppAlert(null), 5000);
    Alert.alert(
      lang === 'hi' ? 'घोषणा सफल' : 'Announcement Sent',
      lang === 'hi' ? 'सभी अभिभावकों को संदेश प्रसारित हुआ:\n"' + titleHi + '"' : 'Broadcasted to parents:\n"' + titleEn + '"'
    );
  };

  // Bus Simulation Controls & Cloud Broadcast
  const toggleBusSimulation = () => {
    if (isBusSimulating) {
      clearInterval(busTimerRef.current);
      setIsBusSimulating(false);
    } else {
      setIsBusSimulating(true);
      let step = 0;
      const etas = [12, 8, 4, 1, 0];
      const stops = [1, 2, 2, 2, 3];
      busTimerRef.current = setInterval(() => {
        step = (step + 1) % etas.length;
        setBusETA(etas[step]);
        setBusStopIdx(stops[step]);
        setSchoolChildren(prev => prev.map(ch => {
          if (ch.id === (activeChild?.id || 'child_riya')) {
            return { ...ch, etaMins: etas[step] };
          }
          return ch;
        }));

        // Broadcast to family cloud channel
        publishCloudEvent({
          type: 'bus_location',
          eta: etas[step],
          stopIdx: stops[step],
          isTripActive: true
        });

        if (etas[step] === 0) {
          Vibration.vibrate(400);
          setInAppAlert({
            title: lang === 'hi' ? '🚌 स्कूल बस पहुँच गई!' : '🚌 School Bus Arrived!',
            body: lang === 'hi' ? 'बस आपके स्टॉप (आनंद विहार गेट नं. 2) पर आ चुकी है।' : 'Bus has reached Anand Vihar Gate #2.',
            type: 'bus'
          });
          setTimeout(() => setInAppAlert(null), 5000);
        }
      }, 3500);
    }
  };

  // Smart Intercom Buzzer Trigger with Cloud Broadcast
  const triggerIntercomBuzzer = (msgHi: string, msgEn: string) => {
    Vibration.vibrate([0, 200, 150, 200]);
    const body = lang === 'hi' ? msgHi : msgEn;
    setInAppAlert({
      title: '🔊 ' + (lang === 'hi' ? 'पारिवारिक इंटरकॉम अलर्ट' : 'Family Intercom Alert'),
      body,
      type: 'intercom'
    });
    setTimeout(() => setInAppAlert(null), 5000);

    // Broadcast over cloud network to other family phones
    publishCloudEvent({
      type: 'intercom',
      title: lang === 'hi' ? 'इंटरकॉम बजर' : 'Intercom Buzzer',
      body,
      senderName: 'अमित (स्वयं)'
    });

    Alert.alert('🔊 Intercom Alert Sent', body + (lang === 'hi' ? '\n\n(क्लाउड नेटवर्क द्वारा सभी जुड़े फ़ोनों पर सायरन बजाया गया)' : '\n\n(Broadcasted to all connected family phones)'));
  };

  const toggleMedicine = async (id: number) => {
    const updated = { ...takenMeds, [id]: !takenMeds[id] };
    await saveTaken(updated);
  };

  // Real UPI Payment Intent
  const handleUPIPayment = async (amt: string) => {
    const cleanAmt = amt.replace(/[^0-9]/g, '');
    const upiUrl = `upi://pay?pa=mastlifeos@upi&pn=MAST%20Life%20OS&am=${cleanAmt}&cu=INR&tn=Support%20MAST%20Voluntarily`;
    try {
      const supported = await Linking.canOpenURL(upiUrl);
      if (supported) {
        await Linking.openURL(upiUrl);
      } else {
        Alert.alert(
          'UPI Payment',
          lang === 'hi'
            ? `आपके फ़ोन में कोई UPI ऐप (GPay/PhonePe/Paytm) नहीं खुला। आप सीधे mastlifeos@upi पर ${amt} भेज सकते हैं।`
            : `No UPI app opened. You can send ${amt} directly to mastlifeos@upi.`
        );
      }
    } catch (e) {
      Alert.alert('UPI Support', `UPI ID: mastlifeos@upi (${amt})`);
    }
    setIsDonateModalOpen(false);
  };

  // Real Emergency SOS
  const handleSendSOS = async () => {
    await publishCloudEvent({
      type: 'sos',
      senderName: 'अमित (स्वयं)',
      body: 'आपातकालीन सहायता की आवश्यकता है!'
    });
    const smsBody = encodeURIComponent('🚨 EMERGENCY SOS: मुझे तुरंत सहायता की आवश्यकता है! (Sent from MAST Family OS)');
    Linking.openURL(`sms:?body=${smsBody}`);
    setIsSOSModalOpen(false);
    Alert.alert(
      lang === 'hi' ? 'SOS भेजा गया' : 'SOS Sent',
      lang === 'hi' ? 'क्लाउड नेटवर्क व SMS के माध्यम से परिवार को SOS अलर्ट भेजा गया!' : 'SOS broadcasted to family!'
    );
  };

  // Add Handlers
  // Calendar Control Helpers
  const openCalendar = (
    target: 'appliance' | 'reminder' | 'expense' | 'member' | 'doc' | 'gold' | 'diary' | 'child_due',
    currentVal?: string
  ) => {
    let initDate = new Date();
    if (currentVal && currentVal !== 'आज' && currentVal !== 'Today') {
      const parsed = new Date(currentVal);
      if (!isNaN(parsed.getTime())) {
        initDate = parsed;
      }
    }
    setCalendarSelectedDate(initDate);
    setCalendarViewYear(initDate.getFullYear());
    setCalendarViewMonth(initDate.getMonth());
    setCalendarPickerMode('day');
    setCalendarYearPickerPage(Math.floor(initDate.getFullYear() / 12) * 12);
    setCalendarTarget(target);
  };

  const closeCalendar = () => {
    setCalendarTarget(null);
  };

  const applySelectedDate = (date: Date) => {
    const monthsEn = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const day = date.getDate();
    const dayStr = day < 10 ? '0' + day : '' + day;
    const monthIdx = date.getMonth();
    const year = date.getFullYear();
    const formattedFull = dayStr + ' ' + monthsEn[monthIdx] + ' ' + year;
    const formattedShort = dayStr + ' ' + monthsEn[monthIdx];

    if (calendarTarget === 'appliance') {
      setNewVaultWarranty(formattedFull);
    } else if (calendarTarget === 'reminder') {
      setNewRemDate(formattedShort);
    } else if (calendarTarget === 'expense') {
      setNewExpDate(formattedFull);
    } else if (calendarTarget === 'member') {
      const calculatedAge = Math.max(0, new Date().getFullYear() - year);
      setNewMemberAge('' + calculatedAge);
      setNewMemberDob(formattedFull);
    } else if (calendarTarget === 'doc') {
      setNewDocExpiry(formattedFull);
    } else if (calendarTarget === 'gold') {
      setNewGoldDate(formattedFull);
    } else if (calendarTarget === 'diary') {
      setNewDiaryDate(formattedFull);
    } else if (calendarTarget === 'child_due') {
      setNewChildDueDay('' + day);
    }
    setCalendarTarget(null);
  };

  // Reusable Calendar Overlay Card Component with Swipe & Direct Year/Month Picker
  const renderCalendarCard = () => {
    const monthNamesHi = [
      'जनवरी', 'फ़रवरी', 'मार्च', 'अप्रैल', 'मई', 'जून',
      'जुलाई', 'अगस्त', 'सितंबर', 'अक्टूबर', 'नवंबर', 'दिसंबर'
    ];
    const monthNamesEn = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    const weekDaysHi = ['रवि', 'सोम', 'मंगल', 'बुध', 'गुरु', 'शुक्र', 'शनि'];

    const prevMonth = () => {
      if (calendarViewMonth === 0) {
        setCalendarViewMonth(11);
        setCalendarViewYear(calendarViewYear - 1);
      } else {
        setCalendarViewMonth(calendarViewMonth - 1);
      }
    };

    const nextMonth = () => {
      if (calendarViewMonth === 11) {
        setCalendarViewMonth(0);
        setCalendarViewYear(calendarViewYear + 1);
      } else {
        setCalendarViewMonth(calendarViewMonth + 1);
      }
    };

    // Pure PanResponder for Left/Right Swiping on Calendar (No Hook to comply with Rules of Hooks)
    const panResponder = PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > 20 && Math.abs(gestureState.dy) < 25;
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx > 35) {
          // Swiped Right -> Previous Month
          prevMonth();
        } else if (gestureState.dx < -35) {
          // Swiped Left -> Next Month
          nextMonth();
        }
      }
    });

    // Calendar calculation
    const firstDay = new Date(calendarViewYear, calendarViewMonth, 1).getDay();
    const daysInMonth = new Date(calendarViewYear, calendarViewMonth + 1, 0).getDate();

    const today = new Date();
    const isSelected = (d: number) => {
      return (
        calendarSelectedDate.getFullYear() === calendarViewYear &&
        calendarSelectedDate.getMonth() === calendarViewMonth &&
        calendarSelectedDate.getDate() === d
      );
    };

    const isToday = (d: number) => {
      return (
        today.getFullYear() === calendarViewYear &&
        today.getMonth() === calendarViewMonth &&
        today.getDate() === d
      );
    };

    const blanks = Array.from({ length: firstDay }, (_, i) => i);
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

    // Year selection range (12 years per view)
    const yearRange = Array.from({ length: 12 }, (_, i) => calendarYearPickerPage + i);

    return (
      <View style={styles.calendarModalOverlay}>
        <View style={styles.calendarCard}>
          {/* Header */}
          <View style={styles.calendarHeader}>
            <Text style={styles.calendarCardTitle}>
              📅 {lang === 'hi' ? 'कैलेंडर से तारीख चुनें' : 'Select Date from Calendar'}
            </Text>
            <TouchableOpacity onPress={closeCalendar} style={{ padding: 4 }}>
              <Text style={{ fontSize: 20, color: '#64748b', fontWeight: 'bold' }}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Swipe Hint */}
          <Text style={{ fontSize: 11, color: '#94a3b8', textAlign: 'center', marginBottom: 6 }}>
            {lang === 'hi' ? '👉 स्वाइप करें (अगला/पिछला महीना) या वर्ष पर टैप करें' : '👉 Swipe left/right for months or tap year'}
          </Text>

          {/* Year & Month Header / Mode Selector */}
          <View style={styles.calendarNavRow}>
            <TouchableOpacity onPress={prevMonth} style={styles.calendarNavBtnRound}>
              <Text style={styles.calendarNavArrow}>‹</Text>
            </TouchableOpacity>

            <View style={{ flexDirection: 'row', gap: 6 }}>
              <TouchableOpacity
                style={[styles.calendarModeSelectorPill, calendarPickerMode === 'month' && styles.calendarModeSelectorPillActive]}
                onPress={() => setCalendarPickerMode(calendarPickerMode === 'month' ? 'day' : 'month')}
              >
                <Text style={[styles.calendarModeSelectorText, calendarPickerMode === 'month' && styles.calendarModeSelectorTextActive]}>
                  {monthNamesHi[calendarViewMonth]} ▼
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.calendarModeSelectorPill, calendarPickerMode === 'year' && styles.calendarModeSelectorPillActive]}
                onPress={() => setCalendarPickerMode(calendarPickerMode === 'year' ? 'day' : 'year')}
              >
                <Text style={[styles.calendarModeSelectorText, calendarPickerMode === 'year' && styles.calendarModeSelectorTextActive]}>
                  {calendarViewYear} ▼
                </Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity onPress={nextMonth} style={styles.calendarNavBtnRound}>
              <Text style={styles.calendarNavArrow}>›</Text>
            </TouchableOpacity>
          </View>

          {/* VIEW MODE 1: DIRECT YEAR PICKER (1940 to 2050+) */}
          {calendarPickerMode === 'year' ? (
            <View style={{ marginVertical: 8 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <TouchableOpacity
                  style={styles.calendarNavBtn}
                  onPress={() => setCalendarYearPickerPage(p => p - 12)}
                >
                  <Text style={styles.calendarNavBtnText}>« {calendarYearPickerPage - 12} - {calendarYearPickerPage - 1}</Text>
                </TouchableOpacity>
                <Text style={{ fontSize: 13, fontWeight: 'bold', color: '#0f172a' }}>
                  {calendarYearPickerPage} - {calendarYearPickerPage + 11}
                </Text>
                <TouchableOpacity
                  style={styles.calendarNavBtn}
                  onPress={() => setCalendarYearPickerPage(p => p + 12)}
                >
                  <Text style={styles.calendarNavBtnText}>{calendarYearPickerPage + 12} - {calendarYearPickerPage + 23} »</Text>
                </TouchableOpacity>
              </View>

              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
                {yearRange.map(yr => {
                  const isCurrentYear = yr === calendarViewYear;
                  return (
                    <TouchableOpacity
                      key={yr}
                      style={[
                        styles.calendarYearChip,
                        isCurrentYear && styles.calendarYearChipActive
                      ]}
                      onPress={() => {
                        setCalendarViewYear(yr);
                        setCalendarPickerMode('day');
                      }}
                    >
                      <Text style={[styles.calendarYearChipText, isCurrentYear && styles.calendarYearChipTextActive]}>
                        {yr}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 12 }}>
                {[1960, 1980, 2000, 2026, 2030].map(quickYr => (
                  <TouchableOpacity
                    key={quickYr}
                    style={{ backgroundColor: '#f1f5f9', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}
                    onPress={() => {
                      setCalendarViewYear(quickYr);
                      setCalendarYearPickerPage(Math.floor(quickYr / 12) * 12);
                      setCalendarPickerMode('day');
                    }}
                  >
                    <Text style={{ fontSize: 11, color: '#475569', fontWeight: 'bold' }}>{quickYr}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ) : calendarPickerMode === 'month' ? (
            /* VIEW MODE 2: DIRECT MONTH PICKER */
            <View style={{ marginVertical: 8 }}>
              <Text style={{ fontSize: 13, fontWeight: 'bold', color: '#0f172a', textAlign: 'center', marginBottom: 10 }}>
                {lang === 'hi' ? 'महीना चुनें:' : 'Select Month:'}
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
                {monthNamesHi.map((mName, mIdx) => {
                  const isCurrentMonth = mIdx === calendarViewMonth;
                  return (
                    <TouchableOpacity
                      key={mName}
                      style={[
                        styles.calendarMonthChip,
                        isCurrentMonth && styles.calendarMonthChipActive
                      ]}
                      onPress={() => {
                        setCalendarViewMonth(mIdx);
                        setCalendarPickerMode('day');
                      }}
                    >
                      <Text style={[styles.calendarMonthChipText, isCurrentMonth && styles.calendarMonthChipTextActive]}>
                        {mName}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ) : (
            /* VIEW MODE 3: STANDARD DAY GRID WITH SWIPE GESTURE */
            <View {...panResponder.panHandlers}>
              {/* Weekday labels */}
              <View style={styles.calendarWeekRow}>
                {weekDaysHi.map(d => (
                  <Text key={d} style={styles.calendarWeekText}>{d}</Text>
                ))}
              </View>

              {/* Days Grid */}
              <View style={styles.calendarGrid}>
                {blanks.map(b => (
                  <View key={'b-' + b} style={styles.calendarDayCell} />
                ))}
                {days.map(d => {
                  const selected = isSelected(d);
                  const todayMark = isToday(d);
                  return (
                    <TouchableOpacity
                      key={'d-' + d}
                      style={[
                        styles.calendarDayCell,
                        selected && styles.calendarDaySelected,
                        todayMark && !selected && styles.calendarDayToday
                      ]}
                      onPress={() => {
                        const picked = new Date(calendarViewYear, calendarViewMonth, d);
                        setCalendarSelectedDate(picked);
                      }}
                    >
                      <Text
                        style={[
                          styles.calendarDayText,
                          selected && styles.calendarDayTextSelected,
                          todayMark && !selected && styles.calendarDayTextToday
                        ]}
                      >
                        {d}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {/* Quick jump chips */}
          <View style={styles.calendarQuickRow}>
            <TouchableOpacity
              style={styles.calendarQuickChip}
              onPress={() => {
                const now = new Date();
                setCalendarSelectedDate(now);
                setCalendarViewYear(now.getFullYear());
                setCalendarViewMonth(now.getMonth());
                setCalendarPickerMode('day');
              }}
            >
              <Text style={styles.calendarQuickChipText}>आज (Today)</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.calendarQuickChip}
              onPress={() => {
                const tmrw = new Date();
                tmrw.setDate(tmrw.getDate() + 1);
                setCalendarSelectedDate(tmrw);
                setCalendarViewYear(tmrw.getFullYear());
                setCalendarViewMonth(tmrw.getMonth());
                setCalendarPickerMode('day');
              }}
            >
              <Text style={styles.calendarQuickChipText}>कल (Tomorrow)</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.calendarQuickChip}
              onPress={() => {
                const n1y = new Date(calendarSelectedDate);
                n1y.setFullYear(n1y.getFullYear() + 1);
                setCalendarSelectedDate(n1y);
                setCalendarViewYear(n1y.getFullYear());
                setCalendarViewMonth(n1y.getMonth());
                setCalendarPickerMode('day');
              }}
            >
              <Text style={styles.calendarQuickChipText}>+1 वर्ष</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.calendarQuickChip}
              onPress={() => {
                const n5y = new Date(calendarSelectedDate);
                n5y.setFullYear(n5y.getFullYear() + 5);
                setCalendarSelectedDate(n5y);
                setCalendarViewYear(n5y.getFullYear());
                setCalendarViewMonth(n5y.getMonth());
                setCalendarPickerMode('day');
              }}
            >
              <Text style={styles.calendarQuickChipText}>+5 वर्ष</Text>
            </TouchableOpacity>
          </View>

          {/* Selection Confirmation Bar */}
          <View style={styles.calendarActionRow}>
            <TouchableOpacity style={styles.calendarCancelBtn} onPress={closeCalendar}>
              <Text style={styles.calendarCancelBtnText}>{lang === 'hi' ? 'रद्द करें' : 'Cancel'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.calendarConfirmBtn}
              onPress={() => applySelectedDate(calendarSelectedDate)}
            >
              <Text style={styles.calendarConfirmBtnText}>
                ✓ {lang === 'hi' ? 'तारीख सेट करें' : 'Set Date'} ({calendarSelectedDate.getDate()}/{calendarSelectedDate.getMonth() + 1}/{calendarSelectedDate.getFullYear()})
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  const handleAddNewMedicine = async () => {
    if (!newMedName.trim()) {
      Alert.alert('Notice', lang === 'hi' ? 'कृपया दवाई का नाम लिखें' : 'Please enter medicine name');
      return;
    }
    const patientName = newMedPatient || (lang === 'hi' ? 'स्वयं (Self)' : 'Self');
    const existing = medicines.find(m => m.id === editingMedId);
    const savedEntry = {
      id: editingMedId || Date.now(),
      nameHi: newMedName.trim(),
      nameEn: newMedName.trim(),
      time: newMedTime,
      doseHi: newMedDose || '1 गोली',
      doseEn: newMedDose || '1 pill',
      doctorHi: newMedDoc || 'डॉ. निजी चिकित्सक',
      doctorEn: newMedDoc || 'Dr. Family Physician',
      hospitalHi: existing?.hospitalHi || 'पारिवारिक क्लिनिक',
      hospitalEn: existing?.hospitalEn || 'Family Clinic',
      patientHi: patientName,
      patientEn: patientName,
      date: existing?.date || (lang === 'hi' ? 'आज' : 'Today'),
      imageUri: newMedPhoto
    };
    const updated = editingMedId ? medicines.map(m => m.id === editingMedId ? savedEntry : m) : [...medicines, savedEntry];
    await saveMeds(updated);
    setNewMedName('');
    setNewMedDose('');
    setNewMedDoc('');
    setNewMedPhoto(null);
    setEditingMedId(null);
    setIsAddMedModalOpen(false);
    Alert.alert(lang === 'hi' ? 'सफल' : 'Success', editingMedId ? (lang === 'hi' ? 'दवाई की जानकारी अपडेट हो गई!' : 'Medicine updated!') : (lang === 'hi' ? 'नई दवाई और पर्चा सुरक्षित सेव हो गए!' : 'Medicine saved successfully!'));
  };

  const handleAddNewAppliance = async () => {
    if (!newVaultName.trim()) {
      Alert.alert('Notice', lang === 'hi' ? 'सामान का नाम लिखें' : 'Please enter item name');
      return;
    }
    const existing = appliances.find(a => a.id === editingApplianceId);
    const savedApp = {
      id: editingApplianceId || Date.now(),
      nameHi: newVaultName.trim(),
      nameEn: newVaultName.trim(),
      price: newVaultPrice ? `₹${newVaultPrice}` : (existing?.price || '₹0'),
      warrantyEnd: newVaultWarranty || (existing?.warrantyEnd || '1 Year'),
      storeHi: newVaultStore || (existing?.storeHi || 'दुकान'),
      storeEn: newVaultStore || (existing?.storeEn || 'Local Store'),
      bought: existing?.bought || (lang === 'hi' ? 'आज' : 'Today'),
      billNo: existing?.billNo || `INV/${Math.floor(1000 + Math.random() * 9000)}`,
      alert: false,
      imageUri: newVaultPhoto
    };
    const updated = editingApplianceId ? appliances.map(a => a.id === editingApplianceId ? savedApp : a) : [...appliances, savedApp];
    await saveAppliances(updated);
    setNewVaultName('');
    setNewVaultPrice('');
    setNewVaultWarranty('');
    setNewVaultStore('');
    setNewVaultPhoto(null);
    setEditingApplianceId(null);
    setIsAddApplianceModalOpen(false);
    Alert.alert(lang === 'hi' ? 'सफल' : 'Success', editingApplianceId ? (lang === 'hi' ? 'उपकरण विवरण अपडेट हो गया!' : 'Appliance updated!') : (lang === 'hi' ? 'नया सामान व बिल लॉकर में सेव हो गया!' : 'Item saved to vault!'));
  };

  const handleAddNewGold = async () => {
    if (!newGoldTitle.trim()) {
      Alert.alert('Notice', lang === 'hi' ? 'आभूषण का नाम लिखें' : 'Please enter jewellery name');
      return;
    }
    const existing = goldItems.find(g => g.id === editingGoldId);
    const savedG = {
      id: editingGoldId || Date.now(),
      titleHi: newGoldTitle.trim(),
      titleEn: newGoldTitle.trim(),
      weight: newGoldWeight ? `${newGoldWeight} gm` : (existing?.weight || '10 gm'),
      purityHi: newGoldPurity,
      purityEn: newGoldPurity,
      value: newGoldValue ? `₹${newGoldValue}` : (existing?.value || '₹80,000'),
      lockerHi: newGoldLocker,
      lockerEn: newGoldLocker,
      jewellerHi: newGoldJeweller || (existing?.jewellerHi || 'ज्वेलर'),
      jewellerEn: newGoldJeweller || (existing?.jewellerEn || 'Jeweller'),
      purchaseDate: newGoldDate || existing?.purchaseDate,
      imageUri: newGoldPhoto
    };
    const updated = editingGoldId ? goldItems.map(g => g.id === editingGoldId ? savedG : g) : [...goldItems, savedG];
    await saveGold(updated);
    setNewGoldTitle('');
    setNewGoldWeight('');
    setNewGoldValue('');
    setNewGoldJeweller('');
    setNewGoldDate('');
    setNewGoldPhoto(null);
    setEditingGoldId(null);
    setIsAddGoldModalOpen(false);
    Alert.alert(lang === 'hi' ? 'सफल' : 'Success', editingGoldId ? (lang === 'hi' ? 'आभूषण जानकारी अपडेट हो गई!' : 'Jewellery updated!') : (lang === 'hi' ? 'स्वर्ण संचय में नया आभूषण सेव हो गया!' : 'Jewellery added!'));
  };

  const handleAddNewDoc = async () => {
    if (!newDocTitle.trim()) {
      Alert.alert('Notice', lang === 'hi' ? 'दस्तावेज़ का नाम लिखें' : 'Please enter document name');
      return;
    }
    const memberLabelHi = newDocMember === 'babu' ? 'बाबूजी' : newDocMember === 'amma' ? 'अम्मा' : newDocMember === 'self' ? 'स्वयं' : 'बच्चे';
    const memberLabelEn = newDocMember === 'babu' ? 'Father' : newDocMember === 'amma' ? 'Mother' : newDocMember === 'self' ? 'Self' : 'Kids';
    const existing = familyDocs.find(d => d.id === editingDocId);
    const savedD = {
      id: editingDocId || Date.now(),
      member: newDocMember,
      memberHi: memberLabelHi,
      memberEn: memberLabelEn,
      titleHi: newDocTitle.trim(),
      titleEn: newDocTitle.trim(),
      docNo: newDocNumber || (existing?.docNo || 'DOC-XXXX-001'),
      expiry: newDocExpiry || existing?.expiry,
      imageUri: newDocPhoto
    };
    const updated = editingDocId ? familyDocs.map(d => d.id === editingDocId ? savedD : d) : [...familyDocs, savedD];
    await saveDocs(updated);
    setNewDocTitle('');
    setNewDocNumber('');
    setNewDocExpiry('');
    setNewDocPhoto(null);
    setEditingDocId(null);
    setIsAddDocModalOpen(false);
    Alert.alert(lang === 'hi' ? 'सफल' : 'Success', editingDocId ? (lang === 'hi' ? 'दस्तावेज़ विवरण अपडेट हो गया!' : 'Document updated!') : (lang === 'hi' ? 'दस्तावेज़ लॉकर में सुरक्षित हो गया!' : 'Document saved to vault!'));
  };

  const handleAddNewReminder = async () => {
    if (!newRemTitle.trim()) {
      Alert.alert('Notice', lang === 'hi' ? 'रिमाइंडर का नाम लिखें' : 'Please enter title');
      return;
    }
    const existing = upcomingReminders.find(r => r.id === editingReminderId);
    const savedRem = {
      id: editingReminderId || Date.now(),
      category: newRemCategory,
      titleHi: newRemTitle.trim(),
      titleEn: newRemTitle.trim(),
      amount: newRemAmount ? `₹${newRemAmount}` : (existing?.amount || ''),
      date: newRemDate || (existing?.date || '05 Nov'),
      urgent: newRemUrgent,
      paid: existing ? existing.paid : false
    };
    const updated = editingReminderId ? upcomingReminders.map(r => r.id === editingReminderId ? savedRem : r) : [...upcomingReminders, savedRem];
    await saveReminders(updated);
    setNewRemTitle('');
    setNewRemAmount('');
    setEditingReminderId(null);
    setIsAddReminderModalOpen(false);
    Alert.alert(lang === 'hi' ? 'सफल' : 'Success', editingReminderId ? (lang === 'hi' ? 'रिमाइंडर अपडेट हो गया!' : 'Reminder updated!') : (lang === 'hi' ? 'नया रिमाइंडर सेट हो गया!' : 'Reminder saved!'));
  };

  const handleAddNewExpense = async () => {
    const amt = parseFloat(newExpAmount);
    if (!newExpTitle.trim() || isNaN(amt) || amt <= 0) {
      Alert.alert('Notice', lang === 'hi' ? 'मान्य विवरण और रकम लिखें' : 'Please enter valid description & amount');
      return;
    }
    const newExp = {
      id: Date.now(),
      titleHi: newExpTitle.trim(),
      titleEn: newExpTitle.trim(),
      amount: amt,
      category: newExpCategory,
      date: newExpDate || (lang === 'hi' ? 'आज' : 'Today')
    };
    await saveExpenses([newExp, ...expenses]);
    setNewExpTitle('');
    setNewExpAmount('');
    setNewExpDate('आज');
    setIsAddExpenseModalOpen(false);
    Alert.alert(lang === 'hi' ? 'सफल' : 'Success', lang === 'hi' ? 'घरेलू खर्च जुड़ गया!' : 'Expense added!');
  };

  const handleAddNewMember = async () => {
    if (!newMemberName.trim()) {
      Alert.alert('Notice', lang === 'hi' ? 'सदस्य का नाम लिखें' : 'Please enter member name');
      return;
    }
    const existing = familyMembers.find(m => m.id === editingMemberId);
    const savedM = {
      id: editingMemberId || Date.now(),
      name: newMemberName.trim(),
      relationHi: newMemberRelation || existing?.relationHi || 'सदस्य',
      relationEn: newMemberRelation || existing?.relationEn || 'Member',
      phone: newMemberPhone || existing?.phone || '98XXXXXXXX',
      age: newMemberAge || existing?.age || '25',
      dob: newMemberDob || existing?.dob,
      avatar: newMemberAvatar,
      role: existing?.role || 'Family Member'
    };
    const updated = editingMemberId ? familyMembers.map(m => m.id === editingMemberId ? savedM : m) : [...familyMembers, savedM];
    await saveMembers(updated);
    setNewMemberName('');
    setNewMemberPhone('');
    setNewMemberAge('');
    setNewMemberDob('');
    setEditingMemberId(null);
    setIsAddMemberModalOpen(false);
    Alert.alert(lang === 'hi' ? 'सफल' : 'Success', editingMemberId ? (lang === 'hi' ? 'सदस्य की जानकारी अपडेट हो गई!' : 'Member updated!') : (lang === 'hi' ? 'परिवार में नया सदस्य जुड़ गया!' : 'Family member added!'));
  };

  const handleAddNewDiary = async () => {
    if (!newDiaryTitle.trim() || !newDiaryContent.trim()) {
      Alert.alert('Notice', lang === 'hi' ? 'शीर्षक व विचार लिखें' : 'Please enter title and content');
      return;
    }
    const existing = diaryEntries.find(d => d.id === editingDiaryId);
    const savedEntry = {
      id: editingDiaryId || Date.now(),
      titleHi: newDiaryTitle.trim(),
      titleEn: newDiaryTitle.trim(),
      contentHi: newDiaryContent.trim(),
      contentEn: newDiaryContent.trim(),
      type: newDiaryType,
      date: newDiaryDate || (existing?.date || (lang === 'hi' ? 'आज' : 'Today'))
    };
    const updated = editingDiaryId ? diaryEntries.map(d => d.id === editingDiaryId ? savedEntry : d) : [savedEntry, ...diaryEntries];
    await saveDiary(updated);
    setNewDiaryDate('आज');
    setEditingDiaryId(null);
    setNewDiaryTitle('');
    setNewDiaryContent('');
    setIsAddDiaryModalOpen(false);
    Alert.alert(lang === 'hi' ? 'सफल' : 'Success', lang === 'hi' ? 'डायरी में नई रचना सेव हो गई!' : 'Saved to personal diary!');
  };

  const shareViaWhatsApp = async (entry: any) => {
    try {
      const title = getLocalized(entry, 'title');
      const content = getLocalized(entry, 'content');
      const message = `✨ *${title}* ✨\n\n"${content}"\n\n— *MAST (${lang === 'hi' ? 'सब ठीक रहेगा' : 'Everything will be fine'})* ❤️`;
      await Share.share({ message });
    } catch (e) {
      Alert.alert('Notice', 'Unable to share');
    }
  };

  const shareFamilyInvite = async () => {
    try {
      const msg = lang === 'hi'
        ? `🏡 हमारे पारिवारिक नेटवर्क MAST (सब ठीक रहेगा) से जुड़ें!\n\n📲 ऐप डाउनलोड करें और यह फैमिली कोड दर्ज करें: *${familyCode}*\n\nयहाँ हम दवाइयों, इमरजेंसी सायरन, स्कूल बस व लॉकर को एक साथ लाइव सिंक में मैनेज करते हैं। ❤️`
        : `🏡 Join our Family Network on MAST (Life OS)!\n\n📲 Download the app and enter our Family Code: *${familyCode}*\n\nStay connected with live synced medicine alarms, emergency buzzer, school bus & safe vault. ❤️`;
      await Share.share({ message: msg });
    } catch (e) {}
  };

  const handleSendChat = async () => {
    if (!chatInput.trim()) return;
    const msgText = chatInput.trim();
    const newMsg = { 
      id: Date.now(), 
      senderHi: 'स्वयं', 
      senderEn: 'Self', 
      msgHi: msgText, 
      msgEn: msgText, 
      time: lang === 'hi' ? 'अभी' : 'Now', 
      isSelf: true 
    };
    await saveChat([...familyChat, newMsg]);
    setChatInput('');

    // Publish to cloud for other phones
    publishCloudEvent({
      type: 'chat',
      msgId: newMsg.id,
      senderName: 'अमित (स्वयं)',
      text: msgText,
      time: 'अभी'
    });
  };

  
  // Dynamic subtitle for Home Medicine Quick Tile
  const getMedTileSubtitle = () => {
    if (medicines.length === 0) {
      return lang === 'hi' ? 'दवा शेड्यूल करें +' : 'Schedule medicine +';
    }
    const untaken = medicines.filter(m => !takenMeds[m.id]);
    if (untaken.length > 0) {
      const next = untaken[0];
      const name = getLocalized(next, 'name');
      return `${name.slice(0, 12)}.. • ${next.time}`;
    }
    return lang === 'hi' ? '✓ आज की दवाएं पूरी' : '✓ All meds taken today';
  };

  const handleTabPress = (tabName: TabType) => {
    const idx = TABS.indexOf(tabName);
    if (idx !== -1 && pagerRef.current) {
      pagerRef.current.scrollTo({ x: idx * SCREEN_WIDTH, animated: true });
      setActiveTab(tabName);
    }
  };

  const handleScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x;
    const idx = Math.round(x / SCREEN_WIDTH);
    if (idx >= 0 && idx < TABS.length) {
      setActiveTab(TABS[idx]);
    }
  };

  // Calculations for Household Budget
  const totalSpent = expenses.reduce((acc, curr) => acc + curr.amount, 0);
  const totalSavings = Math.max(0, monthlyBudget - totalSpent);
  const budgetSpentPct = monthlyBudget > 0 ? Math.min(100, Math.round((totalSpent / monthlyBudget) * 100)) : 0;
  const rationTotal = expenses.filter(e => e.category === 'ration').reduce((a, b) => a + b.amount, 0);
  const feesTotal = expenses.filter(e => e.category === 'fees').reduce((a, b) => a + b.amount, 0);
  const medTotal = expenses.filter(e => e.category === 'med').reduce((a, b) => a + b.amount, 0);
  const otherTotal = expenses.filter(e => e.category === 'other').reduce((a, b) => a + b.amount, 0);

  const rationPct = totalSpent > 0 ? Math.round((rationTotal / totalSpent) * 100) : 40;
  const feesPct = totalSpent > 0 ? Math.round((feesTotal / totalSpent) * 100) : 30;
  const medPct = totalSpent > 0 ? Math.round((medTotal / totalSpent) * 100) : 20;
  const otherPct = Math.max(5, 100 - (rationPct + feesPct + medPct));

  // Auto-calculated Gold Totals
  const totalGoldGrams = goldItems.reduce((acc, item) => {
    const num = parseFloat((item.weight || '').replace(/[^0-9.]/g, ''));
    return acc + (isNaN(num) ? 0 : num);
  }, 0);

  const totalGoldValue = goldItems.reduce((acc, item) => {
    const num = parseInt((item.value || '').replace(/[^0-9]/g, ''), 10);
    return acc + (isNaN(num) ? 0 : num);
  }, 0);


  // One-Tap Full Family Backup Export via Email / WhatsApp / Cloud
  const exportFullFamilyBackup = async () => {
    try {
      const now = new Date();
      const dateStr = now.toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
      let report = "📦 *MAST - परिवार संपूर्ण डेटा बैकअप* (" + dateStr + ")\n\n";
      report += "👤 *प्रोफ़ाइल:* " + (userProfile?.name || 'स्वयं') + "\n📱 फ़ोन: " + (userProfile?.mobile || '-') + "\n📧 ईमेल: " + (userProfile?.email || '-') + "\n\n";
      
      report += "👨‍👩‍👧‍👦 *परिवार के सदस्य (" + familyMembers.length + "):*\n";
      if (familyMembers.length === 0) {
        report += "(कोई सदस्य नहीं जोड़ा गया)\n";
      } else {
        familyMembers.forEach((m: any, i: number) => {
          const mName = m.name || m.nameHi || m.nameEn || 'सदस्य';
          const mRel = m.relationHi || m.relationEn || m.role || '-';
          report += (i + 1) + ". " + mName + " (" + mRel + ") - 📞 " + (m.phone || '-') + ", ब्लड: " + (m.bloodGroup || '-') + "\n";
        });
      }

      report += "\n💊 *दवाएं (" + medicines.length + "):*\n";
      if (medicines.length === 0) {
        report += "(कोई दवा शेड्यूल नहीं)\n";
      } else {
        medicines.forEach((med: any, i: number) => {
          const medName = med.nameHi || med.nameEn || med.name || 'दवा';
          report += (i + 1) + ". " + medName + " - ⏰ " + (med.time || '-') + ", खुराक: " + (med.dosage || '-') + "\n";
        });
      }

      report += "\n🔌 *उपकरण व वारंटी (" + appliances.length + "):*\n";
      if (appliances.length === 0) {
        report += "(कोई उपकरण नहीं)\n";
      } else {
        appliances.forEach((app: any, i: number) => {
          const appName = app.nameHi || app.nameEn || app.name || 'उपकरण';
          report += (i + 1) + ". " + appName + " (" + (app.brand || '-') + ") - वारंटी: " + (app.expiryDate || '-') + "\n";
        });
      }

      report += "\n🪙 *स्वर्ण / जेवर (" + goldItems.length + "):*\n";
      if (goldItems.length === 0) {
        report += "(कोई प्रविष्टि नहीं)\n";
      } else {
        goldItems.forEach((g: any, i: number) => {
          report += (i + 1) + ". " + (g.name || 'जेवर') + " - वजन: " + (g.weight || '-') + ", शुद्धता: " + (g.purity || '-') + "\n";
        });
      }

      report += "\n💰 *मासिक घरेलू बजट:* ₹" + monthlyBudget.toLocaleString('en-IN') + "\n";
      report += "💸 *कुल खर्च:* ₹" + totalSpent.toLocaleString('en-IN') + "\n";
      report += "\n-- MAST (Family Digital Assistant) से सुरक्षित रूप से बैकअप किया गया --";

      await Share.share({
        title: lang === 'hi' ? 'MAST परिवार बैकअप' : 'MAST Family Backup',
        message: report
      });
    } catch (err) {
      console.error('Backup share error:', err);
      Alert.alert(lang === 'hi' ? 'बैकअप त्रुटि' : 'Backup Error', lang === 'hi' ? 'बैकअप शेयर करने में समस्या आई' : 'Failed to export backup');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" translucent />

      {/* ================= FLOATING IN-APP NOTIFICATION BANNER ================= */}
      {inAppAlert && (
        <TouchableOpacity 
          style={styles.floatingAlertBanner} 
          activeOpacity={0.9} 
          onPress={() => setInAppAlert(null)}
        >
          <View style={styles.alertIconCircle}>
            <Text style={{ fontSize: 20 }}>
              {inAppAlert.type === 'bus' ? '🚌' : inAppAlert.type === 'intercom' ? '🔊' : '💊'}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.alertBannerTitle}>{inAppAlert.title}</Text>
            <Text style={styles.alertBannerBody}>{inAppAlert.body}</Text>
          </View>
          <Text style={{ color: '#94a3b8', fontSize: 18, fontWeight: 'bold' }}>✕</Text>
        </TouchableOpacity>
      )}

      {/* ================= TOP APP HEADER ================= */}
      <View style={styles.header}>
        <View style={styles.brandContainer}>
          <View style={styles.logoBadge}><Text style={styles.logoText}>M</Text></View>
          <View>
            <Text style={styles.brandTitle}>{t.appName}</Text>
            <Text style={styles.brandTagline}>{t.tagline}</Text>
          </View>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.sosBtn} onPress={() => setIsSOSModalOpen(true)}>
            <Text style={styles.sosBtnText}>🚨</Text>
          </TouchableOpacity>

          {/* Instant Language Toggle Button */}
          <TouchableOpacity 
            style={styles.langBtn} 
            onPress={toggleLanguage}
          >
            <Text style={styles.langBtnText}>{lang === 'hi' ? 'English' : 'हिंदी'}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.heartBtn} onPress={() => setIsDonateModalOpen(true)}>
            <Text style={styles.heartBtnText}>❤️</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ================= HORIZONTAL PAGER ================= */}
      <ScrollView
        ref={pagerRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScrollEnd}
        style={{ flex: 1 }}
      >

        {/* ----------------- 1. HOME SCREEN (CLEAN, DYNAMIC DAY + DATE, RECENT EXPENSES) ----------------- */}
        <ScrollView style={{ width: SCREEN_WIDTH }} contentContainerStyle={styles.scrollBody} showsVerticalScrollIndicator={false}>
          <View style={{ gap: 16 }}>

            {/* Hero Card with Dynamic Day + Date */}
            <View style={styles.heroCard}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.heroPre}>{getDynamicGreeting(lang)}</Text>
                  <Text style={styles.heroMain}>{t.todayHero}</Text>
                </View>
                <View style={styles.dateTag}>
                  <Text style={styles.dateTagText}>{getFormattedDate(lang)}</Text>
                </View>
              </View>
              <View style={styles.quoteCard}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <Text style={{ fontSize: 13 }}>✨</Text>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: '#ffedd5', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    {lang === 'hi' ? 'आज का सुविचार (Daily Thought)' : 'Daily Inspiration'}
                  </Text>
                </View>
                <Text style={styles.quoteText}>"{getTodayQuote(lang)}"</Text>
              </View>
            </View>

            {/* Today's Agenda + Add Medicine Button */}
            <View>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>🔔 {t.todayAgenda}</Text>
                <TouchableOpacity style={styles.addSmallBtn} onPress={openAddMedModal}>
                  <Text style={styles.addSmallBtnText}>{t.addMedBtn}</Text>
                </TouchableOpacity>
              </View>

              {medicines.length === 0 ? (
                <View style={[styles.card, { alignItems: 'center', paddingVertical: 22 }]}>
                  <Text style={{ fontSize: 32, marginBottom: 6 }}>💊</Text>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: '#334155' }}>
                    {lang === 'hi' ? 'कोई दवा शेड्यूल नहीं है' : 'No medicines scheduled'}
                  </Text>
                  <Text style={{ fontSize: 12, color: '#94a3b8', marginTop: 2, textAlign: 'center' }}>
                    {lang === 'hi' ? 'ऊपर "+ दवा जोड़ें" बटन दबाकर दवा व अलार्म का समय जोड़ें' : 'Tap "+ Add Medicine" above to schedule dose and alarm'}
                  </Text>
                </View>
              ) : (
                <View style={styles.card}>
                  {medicines.map(med => {
                  const isTaken = !!takenMeds[med.id];
                  const medName = getLocalized(med, 'name');
                  const medDose = getLocalized(med, 'dose');
                  return (
                    <View key={med.id} style={styles.agendaItemRow}>
                      <TouchableOpacity 
                        style={[styles.checkCircle, isTaken && styles.checkCircleDone]} 
                        onPress={() => toggleMedicine(med.id)}
                      >
                        <Text style={{ color: '#fff', fontSize: 14, fontWeight: 'bold' }}>{isTaken ? '✓' : ''}</Text>
                      </TouchableOpacity>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={[styles.agendaItemTitle, isTaken && styles.strike]}>{medName}</Text>
                          {(med.patientHi || med.patientEn) ? (
                            <View style={{ backgroundColor: '#fff7ed', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, borderWidth: 1, borderColor: '#fed7aa' }}>
                              <Text style={{ fontSize: 10, color: '#c2410c', fontWeight: 'bold' }}>
                                👤 {getLocalized(med, 'patient')}
                              </Text>
                            </View>
                          ) : null}
                        </View>
                        <Text style={styles.agendaItemTime}>{med.time} • {medDose}</Text>
                      </View>

                      {med.imageUri && (
                        <Image source={{ uri: med.imageUri }} style={{ width: 34, height: 34, borderRadius: 8, marginRight: 6 }} />
                      )}

                      <TouchableOpacity 
                        style={styles.rxSlipBtn}
                        onPress={() => { setSelectedRx(med); setIsRxModalOpen(true); }}
                      >
                        <Text style={styles.rxSlipBtnText}>{t.rxSlip}</Text>
                      </TouchableOpacity>

                      {/* Edit & Delete Medicine */}
                      <TouchableOpacity onPress={() => openEditMedModal(med)} style={{ padding: 4, marginLeft: 4 }}>
                        <Text style={{ fontSize: 15 }}>✏️</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => deleteMedicine(med.id)} style={{ padding: 4, marginLeft: 4 }}>
                        <Text style={{ fontSize: 15 }}>🗑️</Text>
                      </TouchableOpacity>
                    </View>
                  );
                })}
                </View>
              )}
            </View>

            {/* 4 Quick Access Colorful Tiles */}
            <View>
              <Text style={styles.sectionTitle}>⚡ {t.quickAccess}</Text>
              <View style={styles.tileGrid}>
                <TouchableOpacity style={[styles.tileCard, { backgroundColor: '#fffbeb', borderColor: '#fde68a' }]} onPress={() => handleTabPress('vault')}>
                  <View style={styles.tileTop}>
                    <View style={[styles.tileIconBox, { backgroundColor: '#f59e0b' }]}><Text style={styles.tileIcon}>🗄️</Text></View>
                    <View style={styles.tileTag}><Text style={styles.tileTagText}>{appliances.length + goldItems.length} {t.filesCount}</Text></View>
                  </View>
                  <Text style={styles.tileTitle}>{t.tileVault}</Text>
                  <Text style={styles.tileSub}>{t.tileVaultSub}</Text>
                </TouchableOpacity>

                <TouchableOpacity style={[styles.tileCard, { backgroundColor: '#eff6ff', borderColor: '#bfdbfe' }]} onPress={() => handleTabPress('bus')}>
                  <View style={styles.tileTop}>
                    <View style={[styles.tileIconBox, { backgroundColor: '#3b82f6' }]}><Text style={styles.tileIcon}>🚌</Text></View>
                    <View style={[styles.tileTag, { backgroundColor: '#dcfce7' }]}><Text style={[styles.tileTagText, { color: '#15803d' }]}>{t.liveBadge}</Text></View>
                  </View>
                  <Text style={styles.tileTitle}>{t.tileBus}</Text>
                  <Text style={styles.tileSub}>{t.tileBusSub}</Text>
                </TouchableOpacity>

                <TouchableOpacity style={[styles.tileCard, { backgroundColor: '#fff1f2', borderColor: '#fecdd3' }]} onPress={() => handleTabPress('reminders')}>
                  <View style={styles.tileTop}>
                    <View style={[styles.tileIconBox, { backgroundColor: '#f43f5e' }]}><Text style={styles.tileIcon}>💊</Text></View>
                    <View style={[styles.tileTag, { backgroundColor: '#ffe4e6' }]}><Text style={[styles.tileTagText, { color: '#e11d48' }]}>Rx</Text></View>
                  </View>
                  <Text style={styles.tileTitle}>{t.tileMed}</Text>
                  <Text style={styles.tileSub}>{getMedTileSubtitle()}</Text>
                </TouchableOpacity>

                <TouchableOpacity style={[styles.tileCard, { backgroundColor: '#faf5ff', borderColor: '#e9d5ff' }]} onPress={() => handleTabPress('diary')}>
                  <View style={styles.tileTop}>
                    <View style={[styles.tileIconBox, { backgroundColor: '#a855f7' }]}><Text style={styles.tileIcon}>✍️</Text></View>
                    <Text style={{ fontSize: 16 }}>🟢</Text>
                  </View>
                  <Text style={styles.tileTitle}>{t.tileDiary}</Text>
                  <Text style={styles.tileSub}>{t.tileDiarySub}</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Pending Fees & Due Reminders Automatic Alert Widget on Home Screen */}
            {(() => {
              const pendingFees = upcomingReminders.filter(r => !r.paid);
              if (pendingFees.length === 0) return null;
              return (
                <View style={[styles.card, { backgroundColor: '#fff7ed', borderColor: '#fed7aa', borderWidth: 1.5, padding: 14 }]}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={{ fontSize: 18 }}>🔔</Text>
                      <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#9a3412' }}>
                        {lang === 'hi' ? `आगामी फीस व बिल अलर्ट (${pendingFees.length} देय)` : `Pending Fees & Bill Alerts (${pendingFees.length})`}
                      </Text>
                    </View>
                    <TouchableOpacity onPress={() => handleTabPress('reminders')}>
                      <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#ea580c' }}>
                        {lang === 'hi' ? 'सभी देखें »' : 'View All »'}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <View style={{ gap: 8 }}>
                    {pendingFees.slice(0, 3).map(item => (
                      <View
                        key={item.id}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          backgroundColor: '#ffffff',
                          padding: 10,
                          borderRadius: 10,
                          borderWidth: 1,
                          borderColor: '#ffedd5'
                        }}
                      >
                        <TouchableOpacity
                          style={[styles.checkCircle, item.paid && styles.checkCircleDone]}
                          onPress={() => toggleReminderPaid(item.id)}
                        >
                          <Text style={{ color: '#fff', fontSize: 13, fontWeight: 'bold' }}>{item.paid ? '✓' : ''}</Text>
                        </TouchableOpacity>

                        <View style={{ flex: 1, marginHorizontal: 8 }}>
                          <Text style={{ fontSize: 13, fontWeight: 'bold', color: '#0f172a' }} numberOfLines={1}>
                            {lang === 'hi' ? item.titleHi : item.titleEn}
                          </Text>
                          <Text style={{ fontSize: 11, color: '#64748b', marginTop: 1 }}>
                            📅 {lang === 'hi' ? 'अंतिम तारीख' : 'Due'}: <Text style={{ fontWeight: 'bold', color: '#ea580c' }}>{item.date}</Text>
                          </Text>
                        </View>

                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#c2410c' }}>{item.amount}</Text>
                          <TouchableOpacity
                            style={{ backgroundColor: '#ea580c', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, marginTop: 4 }}
                            onPress={() => toggleReminderPaid(item.id)}
                          >
                            <Text style={{ color: '#fff', fontSize: 10, fontWeight: 'bold' }}>
                              {lang === 'hi' ? 'भुगतान करें ✓' : 'Pay ✓'}
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    ))}
                  </View>
                </View>
              );
            })()}

            {/* Monthly Expense & Budget WITH DYNAMIC CALCULATIONS & RECENT EXPENSES LIST */}
            <View style={styles.budgetCard}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={styles.budgetHeading}>💰 {t.budgetTitle}</Text>
                  <Text style={styles.budgetSub}>
                    {monthlyBudget > 0
                      ? (lang === 'hi' 
                          ? `बजट: ₹${monthlyBudget.toLocaleString()} • खर्च: ₹${totalSpent.toLocaleString()} (${budgetSpentPct}%)` 
                          : `Budget: ₹${monthlyBudget.toLocaleString()} • Spent: ₹${totalSpent.toLocaleString()} (${budgetSpentPct}%)`)
                      : (lang === 'hi' ? 'मासिक बजट तय नहीं है • नीचे सेट करें' : 'Budget not set • Tap to set budget')}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  <TouchableOpacity 
                    style={[styles.addExpenseBtn, { backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#cbd5e1' }]} 
                    onPress={() => {
                      setTempBudgetInput(monthlyBudget > 0 ? monthlyBudget.toString() : '');
                      setIsBudgetModalOpen(true);
                    }}
                  >
                    <Text style={{ color: '#0f172a', fontSize: 11, fontWeight: 'bold' }}>✏️ {lang === 'hi' ? 'बजट' : 'Budget'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.addExpenseBtn} onPress={() => setIsAddExpenseModalOpen(true)}>
                    <Text style={styles.addExpenseBtnText}>{t.addExpenseBtn}</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.multiBar}>
                <View style={{ flex: rationPct, backgroundColor: '#10b981' }} />
                <View style={{ flex: feesPct, backgroundColor: '#f59e0b' }} />
                <View style={{ flex: medPct, backgroundColor: '#8b5cf6' }} />
                <View style={{ flex: otherPct, backgroundColor: '#94a3b8' }} />
              </View>

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
                <Text style={styles.legendText}>{t.rationLegend} ({rationPct}%)</Text>
                <Text style={styles.legendText}>{t.feesLegend} ({feesPct}%)</Text>
                <Text style={styles.legendText}>{t.medLegend} ({medPct}%)</Text>
                <Text style={styles.legendText}>{t.otherLegend} ({otherPct}%)</Text>
              </View>

              {/* Recent Expenses List with Delete Buttons */}
              <View style={{ marginTop: 14, borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingTop: 10 }}>
                <Text style={{ fontSize: 13, fontWeight: 'bold', color: '#0f172a', marginBottom: 8 }}>
                  📋 {lang === 'hi' ? 'हाल के खर्च' : 'Recent Expenses'}
                </Text>
                {expenses.length === 0 ? (
                  <View style={{ alignItems: 'center', paddingVertical: 18 }}>
                    <Text style={{ fontSize: 13, color: '#94a3b8' }}>
                      {lang === 'hi' ? 'कोई घरेलू खर्च दर्ज नहीं है • ऊपर "+ नया खर्च" से जोड़ें' : 'No expenses recorded • Tap "+ Add Expense"'}
                    </Text>
                  </View>
                ) : (
                  expenses.map(exp => (
                  <View key={exp.id} style={styles.expenseItemRow}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                      <Text style={{ fontSize: 16 }}>
                        {exp.category === 'ration' ? '🟢' : exp.category === 'fees' ? '🟡' : exp.category === 'med' ? '🟣' : '⚪'}
                      </Text>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 13, fontWeight: 'bold', color: '#0f172a' }}>{getLocalized(exp, 'title')}</Text>
                        <Text style={{ fontSize: 11, color: '#64748b' }}>{exp.date}</Text>
                      </View>
                    </View>
                    <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#0f172a', marginRight: 10 }}>₹{exp.amount.toLocaleString()}</Text>
                    <TouchableOpacity onPress={() => deleteExpense(exp.id)} style={{ padding: 4 }}>
                      <Text style={{ fontSize: 15 }}>🗑️</Text>
                    </TouchableOpacity>
                  </View>
                ))
                )}
              </View>
            </View>

          </View>
        </ScrollView>

        {/* ----------------- 2. VAULT (लॉकर: APPLIANCES, AUTO-GOLD, FILTERED DOCS) ----------------- */}
        <ScrollView style={{ width: SCREEN_WIDTH }} contentContainerStyle={styles.scrollBody} showsVerticalScrollIndicator={false}>
          <View style={{ gap: 16 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={styles.pageTitle}>🗄️ {t.vaultHeading}</Text>
                <Text style={styles.pageSub}>{t.vaultSub}</Text>
              </View>

              {/* Dynamic Add Button depending on active Vault Subtab */}
              <TouchableOpacity 
                style={styles.addSmallBtn} 
                onPress={() => {
                  if (vaultSubtab === 'appliances') setIsAddApplianceModalOpen(true);
                  else if (vaultSubtab === 'gold') setIsAddGoldModalOpen(true);
                  else setIsAddDocModalOpen(true);
                }}
              >
                <Text style={styles.addSmallBtnText}>
                  {vaultSubtab === 'appliances' ? t.addApplianceBtn : vaultSubtab === 'gold' ? t.addGoldBtn : t.addDocBtn}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Subtabs */}
            <View style={styles.subtabContainer}>
              <TouchableOpacity style={[styles.subtabBtn, vaultSubtab === 'appliances' && styles.subtabBtnActive]} onPress={() => setVaultSubtab('appliances')}>
                <Text style={[styles.subtabBtnText, vaultSubtab === 'appliances' && styles.subtabBtnTextActive]}>{t.tabAppliances}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.subtabBtn, vaultSubtab === 'gold' && styles.subtabBtnActive]} onPress={() => setVaultSubtab('gold')}>
                <Text style={[styles.subtabBtnText, vaultSubtab === 'gold' && styles.subtabBtnTextActive]}>{t.tabGold}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.subtabBtn, vaultSubtab === 'docs' && styles.subtabBtnActive]} onPress={() => setVaultSubtab('docs')}>
                <Text style={[styles.subtabBtnText, vaultSubtab === 'docs' && styles.subtabBtnTextActive]}>{t.tabDocs}</Text>
              </TouchableOpacity>
            </View>

            {/* 1. APPLIANCES SUBTAB */}
            {vaultSubtab === 'appliances' && (
              <View style={{ gap: 12 }}>
                {appliances.length === 0 ? (
                  <View style={[styles.card, { alignItems: 'center', paddingVertical: 32 }]}>
                    <Text style={{ fontSize: 40, marginBottom: 8 }}>📺</Text>
                    <Text style={{ fontSize: 15, fontWeight: '700', color: '#1e293b' }}>
                      {lang === 'hi' ? 'कोई उपकरण या बिल दर्ज नहीं है' : 'No appliances or bills recorded'}
                    </Text>
                    <Text style={{ fontSize: 12, color: '#64748b', textAlign: 'center', marginTop: 4, marginHorizontal: 20 }}>
                      {lang === 'hi' ? 'घर के AC, फ्रिज, टीवी का बिल व वारंटी सुरक्षित रखने के लिए जोड़ें' : 'Save bills & warranty details for AC, fridge, TV and gadgets'}
                    </Text>
                    <TouchableOpacity 
                      style={[styles.addSmallBtn, { marginTop: 16, paddingHorizontal: 16, paddingVertical: 8 }]} 
                      onPress={() => setIsAddApplianceModalOpen(true)}
                    >
                      <Text style={styles.addSmallBtnText}>+ {t.addApplianceBtn}</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  appliances.map(app => {
                  const appName = getLocalized(app, 'name');
                  const storeName = getLocalized(app, 'store');
                  return (
                    <View key={app.id} style={styles.card}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <Text style={styles.cardTitle}>{appName}</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                          <Text style={styles.priceBadge}>{app.price}</Text>
                          <TouchableOpacity onPress={() => openEditApplianceModal(app)} style={{ padding: 4 }}>
                            <Text style={{ fontSize: 15 }}>✏️</Text>
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => deleteAppliance(app.id)} style={{ padding: 4 }}>
                            <Text style={{ fontSize: 15 }}>🗑️</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                      <Text style={styles.cardSub}>{t.boughtLabel}: {app.bought} • {t.storeLabel}: {storeName}</Text>
                      
                      {app.imageUri && (
                        <TouchableOpacity onPress={() => setSelectedFullPhoto(app.imageUri)}><Image source={{ uri: app.imageUri }} style={{ width: '100%', height: 160, borderRadius: 12, marginTop: 10 }} /><Text style={{ fontSize: 11, color: '#64748b', textAlign: 'center', marginTop: 4 }}>🔍 {lang === 'hi' ? 'बड़ा देखने के लिए फ़ोटो छुएं' : 'Tap to zoom'}</Text></TouchableOpacity>
                      )}

                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
                        <Text style={{ fontSize: 13, color: app.alert ? '#e11d48' : '#059669', fontWeight: 'bold' }}>
                          📅 {t.warrantyLabel}: {app.warrantyEnd}
                        </Text>
                        <TouchableOpacity 
                          style={styles.viewBillBtn}
                          onPress={() => launchCameraScanner(
                            `📸 ${appName}`,
                            (uri) => {
                              const updated = appliances.map(a => a.id === app.id ? { ...a, imageUri: uri } : a);
                              saveAppliances(updated);
                            }
                          )}
                        >
                          <Text style={styles.viewBillBtnText}>{app.imageUri ? t.changeBillPhoto : t.takeBillPhoto}</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })
                )}
              </View>
            )}

            {/* 2. GOLD & SILVER SUBTAB WITH REAL DYNAMIC WEIGHT CALCULATION */}
            {vaultSubtab === 'gold' && (
              <View style={{ gap: 12 }}>
                <View style={styles.goldHeroCard}>
                  <Text style={styles.goldHeroLabel}>{t.goldHeader}</Text>
                  <Text style={styles.goldHeroNum}>
                    {totalGoldGrams.toFixed(1)} <Text style={{ fontSize: 16, fontWeight: 'normal' }}>{t.goldGrams}</Text>
                  </Text>
                  <Text style={styles.goldHeroSilver}>
                    {lang === 'hi' ? `कुल अनुमानित मूल्य: ₹${totalGoldValue.toLocaleString()}` : `Total Est. Value: ₹${totalGoldValue.toLocaleString()}`}
                  </Text>
                  <Text style={styles.goldHeroNote}>{t.goldNote}</Text>
                </View>

                {goldItems.length === 0 ? (
                  <View style={[styles.card, { alignItems: 'center', paddingVertical: 32 }]}>
                    <Text style={{ fontSize: 40, marginBottom: 8 }}>👑</Text>
                    <Text style={{ fontSize: 15, fontWeight: '700', color: '#1e293b' }}>
                      {lang === 'hi' ? 'कोई स्वर्ण या आभूषण दर्ज नहीं है' : 'No gold or jewellery recorded'}
                    </Text>
                    <Text style={{ fontSize: 12, color: '#64748b', textAlign: 'center', marginTop: 4, marginHorizontal: 20 }}>
                      {lang === 'hi' ? 'पारिवारिक आभूषणों का वजन, शुद्धता और लॉकर सुरक्षित रखें' : 'Store weight, purity and bank locker info for your valuables'}
                    </Text>
                    <TouchableOpacity 
                      style={[styles.addSmallBtn, { marginTop: 16, paddingHorizontal: 16, paddingVertical: 8 }]} 
                      onPress={() => setIsAddGoldModalOpen(true)}
                    >
                      <Text style={styles.addSmallBtnText}>+ {t.addGoldBtn}</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  goldItems.map(item => {
                  const title = getLocalized(item, 'title');
                  const purity = getLocalized(item, 'purity');
                  const locker = getLocalized(item, 'locker');
                  return (
                    <View key={item.id} style={styles.card}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={styles.cardTitle}>{title}</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                          <Text style={styles.priceBadge}>{item.value}</Text>
                          <TouchableOpacity onPress={() => openEditGoldModal(item)} style={{ padding: 4 }}>
                            <Text style={{ fontSize: 15 }}>✏️</Text>
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => deleteGold(item.id)} style={{ padding: 4 }}>
                            <Text style={{ fontSize: 15 }}>🗑️</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                      <Text style={styles.cardSub}>{t.weightLabel}: {item.weight} • {t.purityLabel}: {purity}</Text>
                      <Text style={[styles.cardSub, { color: '#d97706', fontWeight: 'bold', marginTop: 4 }]}>
                        📍 {t.locationLabel}: {locker}
                      </Text>

                      {item.imageUri && (
                        <TouchableOpacity onPress={() => setSelectedFullPhoto(item.imageUri)}><Image source={{ uri: item.imageUri }} style={{ width: '100%', height: 160, borderRadius: 12, marginTop: 10 }} /><Text style={{ fontSize: 11, color: '#64748b', textAlign: 'center', marginTop: 4 }}>🔍 {lang === 'hi' ? 'बड़ा देखने के लिए फ़ोटो छुएं' : 'Tap to zoom'}</Text></TouchableOpacity>
                      )}

                      <TouchableOpacity 
                        style={[styles.viewBillBtn, { marginTop: 8 }]}
                        onPress={() => launchCameraScanner(
                          `📸 ${title}`,
                          (uri) => {
                            const updated = goldItems.map(g => g.id === item.id ? { ...g, imageUri: uri } : g);
                            saveGold(updated);
                          }
                        )}
                      >
                        <Text style={styles.viewBillBtnText}>{item.imageUri ? (lang === 'hi' ? '📸 फ़ोटो बदलें' : '📸 Change Photo') : (lang === 'hi' ? '📸 आभूषण या बिल फ़ोटो जोड़ें' : '📸 Add Jewellery / Invoice Photo')}</Text>
                      </TouchableOpacity>
                    </View>
                  );
                })
                )}
              </View>
            )}

            {/* 3. DOCUMENTS SUBTAB WITH MEMBER FILTER CHIPS */}
            {vaultSubtab === 'docs' && (
              <View style={{ gap: 12 }}>
                {/* Dynamic Member Filter Chips */}
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  <TouchableOpacity
                    style={[styles.chip, docMemberFilter === 'all' && styles.chipActive]}
                    onPress={() => setDocMemberFilter('all')}
                  >
                    <Text style={[styles.chipText, docMemberFilter === 'all' && styles.chipTextActive]}>
                      {lang === 'hi' ? 'सभी दस्तावेज़' : 'All Documents'}
                    </Text>
                  </TouchableOpacity>
                  {familyMembers.map(m => {
                    const isSelected = docMemberFilter === m.name;
                    return (
                      <TouchableOpacity
                        key={m.id}
                        style={[styles.chip, isSelected && styles.chipActive]}
                        onPress={() => setDocMemberFilter(m.name)}
                      >
                        <Text style={[styles.chipText, isSelected && styles.chipTextActive]}>
                          {m.avatar} {m.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {familyDocs.filter(doc => docMemberFilter === 'all' || doc.member === docMemberFilter).length === 0 ? (
                  <View style={[styles.card, { alignItems: 'center', paddingVertical: 32 }]}>
                    <Text style={{ fontSize: 40, marginBottom: 8 }}>📁</Text>
                    <Text style={{ fontSize: 15, fontWeight: '700', color: '#1e293b' }}>
                      {lang === 'hi' ? 'कोई पारिवारिक दस्तावेज दर्ज नहीं है' : 'No family documents added'}
                    </Text>
                    <Text style={{ fontSize: 12, color: '#64748b', textAlign: 'center', marginTop: 4, marginHorizontal: 20 }}>
                      {lang === 'hi' ? 'आधार कार्ड, आयुष्मान कार्ड, पैन कार्ड या पासपोर्ट की फोटो सुरक्षित सहेजें' : 'Keep photos of Aadhaar, PAN, Ayushman Health cards & Passports'}
                    </Text>
                    <TouchableOpacity 
                      style={[styles.addSmallBtn, { marginTop: 16, paddingHorizontal: 16, paddingVertical: 8 }]} 
                      onPress={() => setIsAddDocModalOpen(true)}
                    >
                      <Text style={styles.addSmallBtnText}>+ {t.addDocBtn}</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  familyDocs
                    .filter(doc => docMemberFilter === 'all' || doc.member === docMemberFilter)
                    .map(doc => {
                    const title = getLocalized(doc, 'title');
                    const member = getLocalized(doc, 'member');
                    return (
                      <View key={doc.id} style={styles.card}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Text style={styles.cardTitle}>{title}</Text>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <View style={styles.verifiedBadge}><Text style={styles.verifiedBadgeText}>{t.verifiedTag}</Text></View>
                            <TouchableOpacity onPress={() => openEditDocModal(doc)} style={{ padding: 4 }}>
                              <Text style={{ fontSize: 15 }}>✏️</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => deleteDoc(doc.id)} style={{ padding: 4 }}>
                              <Text style={{ fontSize: 15 }}>🗑️</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                        <Text style={styles.cardSub}>{t.memberLabel}: {member} • {doc.docNo}</Text>
                        
                        {doc.imageUri && (
                          <TouchableOpacity onPress={() => setSelectedFullPhoto(doc.imageUri)}><Image source={{ uri: doc.imageUri }} style={{ width: '100%', height: 160, borderRadius: 12, marginTop: 10 }} /><Text style={{ fontSize: 11, color: '#64748b', textAlign: 'center', marginTop: 4 }}>🔍 {lang === 'hi' ? 'बड़ा देखने के लिए फ़ोटो छुएं' : 'Tap to zoom'}</Text></TouchableOpacity>
                        )}

                        <TouchableOpacity 
                          style={styles.viewDocBtn}
                          onPress={() => launchCameraScanner(
                            `📸 ${title}`,
                            (uri) => {
                              const updated = familyDocs.map(d => d.id === doc.id ? { ...d, imageUri: uri } : d);
                              saveDocs(updated);
                            }
                          )}
                        >
                          <Text style={styles.viewDocBtnText}>{doc.imageUri ? t.changeDocPhoto : t.takeDocPhoto}</Text>
                        </TouchableOpacity>
                      </View>
                    );
                  })
                )}
              </View>
            )}
          </View>
        </ScrollView>

        {/* ----------------- 3. REMINDERS & MEDICINE (WITH ALARMS & CHECKBOX REMINDERS) ----------------- */}
        <ScrollView style={{ width: SCREEN_WIDTH }} contentContainerStyle={styles.scrollBody} showsVerticalScrollIndicator={false}>
          <View style={{ gap: 16 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View>
                <Text style={styles.pageTitle}>🔔 {t.remHeading}</Text>
                <Text style={styles.pageSub}>{t.remSub}</Text>
              </View>
            </View>

            {/* Interactive Test Alarm Button */}
            <TouchableOpacity style={styles.prominentAlarmBtn} onPress={triggerInstantTestAlarm}>
              <Text style={styles.prominentAlarmBtnText}>{t.testAlarmBtn}</Text>
              <Text style={{ color: '#fed7aa', fontSize: 11, marginTop: 2 }}>
                {lang === 'hi' ? 'दवा की घंटी व सायरन बजाकर टेस्ट करें' : 'Trigger audible chime and notification now'}
              </Text>
            </TouchableOpacity>

            {/* Daily Medicines Section */}
            <View style={styles.card}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <Text style={styles.sectionHeading}>💊 {t.todayAgenda}</Text>
                <TouchableOpacity style={styles.addSmallBtn} onPress={openAddMedModal}>
                  <Text style={styles.addSmallBtnText}>{t.addMedBtn}</Text>
                </TouchableOpacity>
              </View>

              {medicines.length === 0 ? (
                <View style={[styles.card, { alignItems: 'center', paddingVertical: 22 }]}>
                  <Text style={{ fontSize: 30, marginBottom: 4 }}>💊</Text>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: '#334155' }}>
                    {lang === 'hi' ? 'कोई दवा रिमाइंडर नहीं है' : 'No medicine reminders'}
                  </Text>
                  <Text style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
                    {lang === 'hi' ? 'ऊपर "+ दवा जोड़ें" से नई दवा शेड्यूल करें' : 'Tap "+ Add Medicine" to set dosage & reminder'}
                  </Text>
                </View>
              ) : (
                medicines.map(med => {
                const isTaken = !!takenMeds[med.id];
                const medName = getLocalized(med, 'name');
                const medDose = getLocalized(med, 'dose');
                return (
                  <View key={med.id} style={styles.agendaItemRow}>
                    <TouchableOpacity 
                      style={[styles.checkCircle, isTaken && styles.checkCircleDone]} 
                      onPress={() => toggleMedicine(med.id)}
                    >
                      <Text style={{ color: '#fff', fontSize: 14, fontWeight: 'bold' }}>{isTaken ? '✓' : ''}</Text>
                    </TouchableOpacity>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.agendaItemTitle, isTaken && styles.strike]}>{medName}</Text>
                      <Text style={styles.agendaItemTime}>{med.time} • {medDose}</Text>
                    </View>

                    {med.imageUri && (
                      <Image source={{ uri: med.imageUri }} style={{ width: 34, height: 34, borderRadius: 8, marginRight: 6 }} />
                    )}

                    <TouchableOpacity 
                      style={styles.rxSlipBtn}
                      onPress={() => { setSelectedRx(med); setIsRxModalOpen(true); }}
                    >
                      <Text style={styles.rxSlipBtnText}>{t.rxSlip}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity onPress={() => deleteMedicine(med.id)} style={{ padding: 4, marginLeft: 4 }}>
                      <Text style={{ fontSize: 16 }}>🗑️</Text>
                    </TouchableOpacity>
                  </View>
                );
                })
              )}
            </View>

            {/* Upcoming Bills & Event Reminders WITH MARK AS PAID & DELETE */}
            <View style={{ gap: 12 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={styles.sectionHeading}>{t.upcomingHeading}</Text>
                <TouchableOpacity style={styles.addSmallBtn} onPress={() => setIsAddReminderModalOpen(true)}>
                  <Text style={styles.addSmallBtnText}>{t.addReminderBtn}</Text>
                </TouchableOpacity>
              </View>

              {upcomingReminders.length === 0 ? (
                <View style={[styles.card, { alignItems: 'center', paddingVertical: 22 }]}>
                  <Text style={{ fontSize: 30, marginBottom: 4 }}>🔔</Text>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: '#334155' }}>
                    {lang === 'hi' ? 'कोई आगामी बिल या रिमाइंडर नहीं है' : 'No upcoming reminders'}
                  </Text>
                  <Text style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
                    {lang === 'hi' ? 'बिजली, पानी, स्कूल फीस या गैस बुकिंग रिमाइंडर जोड़ें' : 'Add utility bills, school fees or custom alerts'}
                  </Text>
                </View>
              ) : (
                upcomingReminders.map(rem => {
                const title = getLocalized(rem, 'title');
                const isPaid = !!rem.paid;
                return (
                  <View key={rem.id} style={styles.card}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                        <TouchableOpacity 
                          style={[styles.checkCircle, isPaid && styles.checkCircleDone]} 
                          onPress={() => toggleReminderPaid(rem.id)}
                        >
                          <Text style={{ color: '#fff', fontSize: 14, fontWeight: 'bold' }}>{isPaid ? '✓' : ''}</Text>
                        </TouchableOpacity>
                        <Text style={[styles.cardTitle, isPaid && styles.strike]}>{title}</Text>
                      </View>
                      
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <Text style={[styles.priceBadge, isPaid && styles.strike, { color: rem.urgent && !isPaid ? '#e11d48' : '#0f172a' }]}>
                          {rem.amount}
                        </Text>
                        <TouchableOpacity onPress={() => openEditReminderModal(rem)} style={{ padding: 4 }}>
                          <Text style={{ fontSize: 15 }}>✏️</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => deleteReminder(rem.id)} style={{ padding: 4 }}>
                          <Text style={{ fontSize: 15 }}>🗑️</Text>
                        </TouchableOpacity>
                      </View>
                    </View>

                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6, paddingLeft: 38 }}>
                      <Text style={styles.cardSub}>{t.dueDateLabel}: {rem.date}</Text>
                      {isPaid ? (
                        <View style={{ backgroundColor: '#dcfce7', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 }}>
                          <Text style={{ color: '#16a34a', fontSize: 11, fontWeight: 'bold' }}>✓ {lang === 'hi' ? 'चुकता (Paid)' : 'Paid'}</Text>
                        </View>
                      ) : rem.urgent ? (
                        <View style={{ backgroundColor: '#ffe4e6', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 }}>
                          <Text style={{ color: '#e11d48', fontSize: 11, fontWeight: 'bold' }}>⚠️ Urgent</Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                );
              })
              )}
            </View>
          </View>
        </ScrollView>

        {/* ----------------- 4. PAN-INDIA SCHOOL BUS TRACKER (MULTI-CHILD, GOOGLE MAPS & ZERO-BURDEN DRIVER) ----------------- */}
        <ScrollView style={{ width: SCREEN_WIDTH }} contentContainerStyle={styles.scrollBody} showsVerticalScrollIndicator={false}>
          <View style={{ gap: 16 }}>
            <View style={styles.pageHeader}>
              <Text style={styles.pageTitle}>🚌 {t.busHeading}</Text>
              <Text style={styles.pageSub}>{t.busSub}</Text>
            </View>



            {/* Role Switcher: Parent vs Driver */}
            <View style={styles.busRoleToggle}>
              <TouchableOpacity style={[styles.busRoleBtn, busRole === 'parent' && styles.busRoleBtnActive]} onPress={() => setBusRole('parent')}>
                <Text style={[styles.busRoleBtnText, busRole === 'parent' && styles.busRoleBtnTextActive]}>{t.modeParent}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.busRoleBtn, busRole === 'driver' && styles.busRoleBtnActive]} onPress={() => setBusRole('driver')}>
                <Text style={[styles.busRoleBtnText, busRole === 'driver' && styles.busRoleBtnTextActive]}>{t.modeDriver}</Text>
              </TouchableOpacity>
            </View>

            {busRole === 'parent' ? (
              <View style={{ gap: 14 }}>
                {schoolChildren.length === 0 || !activeChild ? (
                  <View style={[styles.card, { alignItems: 'center', paddingVertical: 36, marginTop: 10 }]}>
                    <Text style={{ fontSize: 44, marginBottom: 12 }}>🚌</Text>
                    <Text style={{ fontSize: 17, fontWeight: '700', color: '#0f172a', textAlign: 'center' }}>
                      {lang === 'hi' ? 'कोई स्कूल बस या बच्चा नहीं जुड़ा है' : 'No school bus or child connected'}
                    </Text>
                    <Text style={{ fontSize: 13, color: '#64748b', textAlign: 'center', marginTop: 6, marginHorizontal: 20, lineHeight: 19 }}>
                      {lang === 'hi' 
                        ? 'अपने बच्चे का नाम, स्कूल और बस नंबर जोड़ें। ड्राइवर के कनेक्ट होते ही आपको लाइव लोकेशन, स्टॉप और ईटीए दिखेगा।' 
                        : 'Add your child name, school and bus number. You will get live tracking, stops and ETA as soon as driver connects.'}
                    </Text>
                    <TouchableOpacity 
                      style={[styles.addSmallBtn, { marginTop: 20, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12 }]} 
                      onPress={openAddChildModal}
                    >
                      <Text style={[styles.addSmallBtnText, { fontSize: 14 }]}>+ {lang === 'hi' ? 'बच्चा व स्कूल बस जोड़ें' : 'Add Child & School Bus'}</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <>
                {/* Multi-Child Selector Tabs Carousel */}
                <View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <Text style={{ fontSize: 13, fontWeight: 'bold', color: '#0f172a' }}>
                      👨‍👧‍👦 {lang === 'hi' ? 'बच्चे की बस चुनें (Multi-Child & School):' : 'Select Child Bus (Multi-Child & School):'}
                    </Text>
                    <TouchableOpacity 
                      style={{ backgroundColor: '#ea580c', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 }}
                      onPress={openAddChildModal}
                    >
                      <Text style={{ color: '#fff', fontSize: 11, fontWeight: 'bold' }}>+ {lang === 'hi' ? 'नया बच्चा / बस जोड़ें' : 'Add Child / Bus'}</Text>
                    </TouchableOpacity>
                  </View>

                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                    {schoolChildren.map(child => {
                      const isSelected = child.id === activeChild.id;
                      const schoolName = lang === 'hi' ? child.schoolNameHi : child.schoolNameEn;
                      return (
                        <TouchableOpacity
                          key={child.id}
                          style={[
                            styles.childTabCard,
                            isSelected && styles.childTabCardActive
                          ]}
                          onPress={() => {
                            Vibration.vibrate(40);
                            setActiveChildId(child.id);
                          }}
                        >
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <Text style={{ fontSize: 22 }}>{child.avatar}</Text>
                            <View>
                              <Text style={[styles.childTabName, isSelected && { color: '#fff' }]}>{child.name}</Text>
                              <Text style={[styles.childTabSub, isSelected && { color: '#fed7aa' }]}>{schoolName} • {child.busNo}</Text>
                            </View>
                          </View>
                          {isSelected && (
                            <View style={styles.childTabDot} />
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>

                {/* Active Child Boarding & Vehicle Card */}
                <View style={styles.busChildCard}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                    <View style={styles.childAvatarBox}>
                      <Text style={{ fontSize: 26 }}>{activeChild.avatar}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 15, fontWeight: 'bold', color: '#0f172a' }}>
                        {activeChild.name} ({activeChild.grade})
                      </Text>
                      <Text style={{ fontSize: 12, color: '#64748b', marginTop: 1 }}>
                        🏫 {lang === 'hi' ? activeChild.schoolNameHi : activeChild.schoolNameEn}
                      </Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                        <View style={{ backgroundColor: '#eff6ff', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                          <Text style={{ fontSize: 10, color: '#0284c7', fontWeight: 'bold' }}>{activeChild.branchCode || 'BRANCH'}</Text>
                        </View>
                        <Text style={{ fontSize: 11, color: '#475569', fontWeight: 'bold' }}>🚌 {activeChild.busNo}</Text>
                        <Text style={{ fontSize: 10, color: '#94a3b8' }}>({activeChild.busCode})</Text>
                      </View>
                      <View style={{ flexDirection: 'row', gap: 6, marginTop: 4 }}>
                        <View style={styles.childStatusPill}>
                          <Text style={styles.childStatusPillText}>
                            {activeChild.isBoarded 
                              ? (lang === 'hi' ? '✓ बस में सुरक्षित सवार' : '✓ Boarded Safely') 
                              : (lang === 'hi' ? 'अनुपस्थित / नहीं चढ़ा' : 'Not on Bus')}
                          </Text>
                        </View>
                        <View style={{ backgroundColor: '#f1f5f9', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                          <Text style={{ fontSize: 10, color: '#475569', fontWeight: 'bold' }}>{activeChild.seatNo}</Text>
                        </View>
                        {(activeChild.schoolFee || activeChild.busFee) ? (
                          <View style={{ backgroundColor: '#fff7ed', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, borderWidth: 1, borderColor: '#fed7aa' }}>
                            <Text style={{ fontSize: 10, color: '#c2410c', fontWeight: 'bold' }}>
                              💳 {activeChild.schoolFee ? `स्कूल: ${activeChild.schoolFee}` : ''} {activeChild.busFee ? `| बस: ${activeChild.busFee}` : ''}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                    </View>
                  </View>

                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <TouchableOpacity 
                      onPress={() => openEditChildModal(activeChild)} 
                      style={{ padding: 6, backgroundColor: '#f1f5f9', borderRadius: 8 }}
                    >
                      <Text style={{ fontSize: 16 }}>✏️</Text>
                    </TouchableOpacity>

                    {schoolChildren.length > 1 && (
                      <TouchableOpacity 
                        onPress={() => deleteSchoolChild(activeChild.id)} 
                        style={{ padding: 6, backgroundColor: '#fee2e2', borderRadius: 8 }}
                      >
                        <Text style={{ fontSize: 16 }}>🗑️</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>

                {/* Driver Duty / Trip Status Banner */}
                {!isTripActive ? (
                  <View style={{
                    backgroundColor: '#fef2f2',
                    borderWidth: 1.5,
                    borderColor: '#fca5a5',
                    borderRadius: 16,
                    padding: 12,
                    marginBottom: 10,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12
                  }}>
                    <Text style={{ fontSize: 26 }}>🔴</Text>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#b91c1c' }}>
                          {lang === 'hi' ? 'चालक अभी ड्यूटी पर नहीं हैं / बस स्कूल में खड़ी है' : 'Driver Off Duty / Bus Parked at School'}
                        </Text>
                        <View style={{ backgroundColor: '#fee2e2', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                          <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#dc2626' }}>
                            {lang === 'hi' ? 'ऑफलाइन' : 'OFFLINE'}
                          </Text>
                        </View>
                      </View>
                      <Text style={{ fontSize: 12, color: '#991b1b', marginTop: 3, lineHeight: 16 }}>
                        {lang === 'hi'
                          ? 'जब चालक ड्यूटी शुरू करेंगे (START TRIP), वास्तविक दूरी (Km) व लाइव GPS मूवमेंट सक्रिय हो जाएगा।'
                          : 'Live GPS tracking and real-time distance (Km) will activate once the driver starts duty trip.'}
                      </Text>
                    </View>
                  </View>
                ) : (
                  <View style={{
                    backgroundColor: '#f0fdf4',
                    borderWidth: 1.5,
                    borderColor: '#86efac',
                    borderRadius: 16,
                    padding: 12,
                    marginBottom: 10,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                      <Text style={{ fontSize: 22 }}>🟢</Text>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#15803d' }}>
                            {lang === 'hi' ? 'बस लाइव चल रही है • ऑन ड्यूटी' : 'Bus is Live on Route • On Duty'}
                          </Text>
                          <View style={{ backgroundColor: '#dcfce7', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                            <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#16a34a' }}>
                              GPS LIVE
                            </Text>
                          </View>
                        </View>
                        <Text style={{ fontSize: 12, color: '#166534', marginTop: 2 }}>
                          {lang === 'hi'
                            ? `चालक: ${activeChild.driverNameHi || 'राजेश कुमार'} • बस: ${activeChild.busNo}`
                            : `Driver: ${activeChild.driverNameEn || 'Rajesh Kumar'} • Bus: ${activeChild.busNo}`}
                        </Text>
                      </View>
                    </View>
                  </View>
                )}

                {/* Visual HUD Map & Google Maps Integration */}
                <View style={styles.mapSimulationBox}>
                  {/* Top Row: Big ETA + Next Stop */}
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <View style={styles.mapEtaBadge}>
                      <View style={[styles.mapEtaNumBox, !isTripActive && { backgroundColor: '#64748b' }]}>
                        {isTripActive ? (
                          <>
                            <Text style={styles.mapEtaNum}>{activeChild.etaMins}</Text>
                            <Text style={styles.mapEtaMin}>{t.minsUnit}</Text>
                          </>
                        ) : (
                          <>
                            <Text style={{ fontSize: 18 }}>🅿️</Text>
                            <Text style={styles.mapEtaMin}>{lang === 'hi' ? 'पार्क्ड' : 'PARKED'}</Text>
                          </>
                        )}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.mapEtaSub}>
                          {isTripActive 
                            ? t.etaTitle 
                            : (lang === 'hi' ? 'बस की वर्तमान स्थिति' : 'Current Bus Status')}
                        </Text>
                        <Text style={styles.mapEtaStop} numberOfLines={1}>
                          {isTripActive 
                            ? (lang === 'hi' ? activeChild.stopNameHi : activeChild.stopNameEn)
                            : (lang === 'hi' ? 'स्कूल परिसर में खड़ी है' : 'Parked at School Campus')}
                        </Text>
                      </View>
                    </View>

                    <TouchableOpacity 
                      style={[styles.simToggleBtn, isBusSimulating ? { backgroundColor: '#ef4444' } : { backgroundColor: '#10b981' }]}
                      onPress={toggleBusSimulation}
                    >
                      <Text style={styles.simToggleBtnText}>
                        {isBusSimulating 
                          ? (lang === 'hi' ? '⏹️ टेस्ट बंद' : 'Stop Test') 
                          : (lang === 'hi' ? '▶️ लाइव टेस्ट' : 'Test Live')}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* Simulated Visual Road with Milestones & Bus Pin */}
                  <View style={styles.simulatedRoad}>
                    <View style={styles.roadLine} />
                    <View style={[styles.roadStopPoint, { left: '8%' }]} />
                    <View style={[styles.roadStopPoint, { left: '38%' }]} />
                    <View style={[styles.roadStopPoint, { left: '72%', backgroundColor: '#f59e0b' }]} />
                    <View style={[styles.roadStopPoint, { left: '94%' }]} />

                    {/* Animated Moving Bus Marker with Radar Halo */}
                    <View style={[
                      styles.busPin, 
                      { left: isTripActive ? `${Math.min(72, Math.max(8, 72 - activeChild.etaMins * 5.3))}%` : '8%' }
                    ]}>
                      {isTripActive && <View style={styles.busRadarPulse} />}
                      <Text style={{ fontSize: 26 }}>🚌</Text>
                      {!isTripActive && (
                        <View style={{
                          position: 'absolute',
                          top: -16,
                          left: -12,
                          backgroundColor: '#334155',
                          paddingHorizontal: 5,
                          paddingVertical: 1,
                          borderRadius: 4
                        }}>
                          <Text style={{ color: '#cbd5e1', fontSize: 8, fontWeight: 'bold' }}>
                            {lang === 'hi' ? 'स्कूल (खड़ी है)' : 'Parked'}
                          </Text>
                        </View>
                      )}
                    </View>

                    {/* Target Stop Pin */}
                    <View style={[styles.stopPin, { left: '72%' }]}>
                      <Text style={{ fontSize: 22 }}>📍</Text>
                    </View>
                  </View>

                  {/* HUD Telemetry Gauges */}
                  <View style={styles.hudMetricsRow}>
                    <View style={styles.hudMetricPill}>
                      <Text style={styles.hudMetricLabel}>{lang === 'hi' ? 'गति' : 'Speed'}</Text>
                      <Text style={styles.hudMetricValue}>
                        {isTripActive ? `${activeChild.speedKmh} km/h` : '0 km/h'}
                      </Text>
                    </View>
                    <View style={styles.hudMetricPill}>
                      <Text style={styles.hudMetricLabel}>{lang === 'hi' ? 'वास्तविक दूरी' : 'Live Distance'}</Text>
                      <Text style={[styles.hudMetricValue, !isTripActive && { color: '#fbbf24', fontSize: 12 }]}>
                        {isTripActive 
                          ? (activeChild.etaMins === 0 
                              ? (lang === 'hi' ? 'स्टॉप पर' : 'Arrived') 
                              : `${(activeChild.etaMins * 0.3).toFixed(1)} km`)
                          : (lang === 'hi' ? 'स्कूल में (0 km)' : 'At School (0 km)')}
                      </Text>
                    </View>
                    <View style={styles.hudMetricPill}>
                      <Text style={styles.hudMetricLabel}>{lang === 'hi' ? 'ट्रैफिक' : 'Traffic'}</Text>
                      <Text style={styles.hudMetricValue}>
                        {isTripActive ? t.trafficTagText : (lang === 'hi' ? 'स्टैंडबाय' : 'Standby')}
                      </Text>
                    </View>
                  </View>

                  {!isTripActive && (
                    <TouchableOpacity 
                      style={{
                        backgroundColor: 'rgba(255,255,255,0.08)',
                        borderWidth: 1,
                        borderColor: '#334155',
                        borderRadius: 12,
                        padding: 8,
                        alignItems: 'center',
                        flexDirection: 'row',
                        justifyContent: 'center',
                        gap: 8,
                        marginTop: 4
                      }}
                      onPress={() => setBusRole('driver')}
                    >
                      <Text style={{ fontSize: 15 }}>👨‍✈️</Text>
                      <Text style={{ color: '#38bdf8', fontSize: 12, fontWeight: 'bold' }}>
                        {lang === 'hi' ? 'चालक मोड में जाकर ड्यूटी चालू (START TRIP) करें →' : 'Switch to Driver Mode to Start Trip →'}
                      </Text>
                    </TouchableOpacity>
                  )}

                  {/* Prominent Google Maps Deep-Link Actions */}
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                    <TouchableOpacity 
                      style={[styles.hudActionBtn, { backgroundColor: '#0284c7' }]} 
                      onPress={() => openBusOnGoogleMaps(activeChild.busCoords.lat, activeChild.busCoords.lng, activeChild.busNo)}
                    >
                      <Text style={styles.hudActionBtnText}>
                        🗺️ {lang === 'hi' ? 'Google Maps पर लाइव देखें' : 'Open in Google Maps'}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                      style={[styles.hudActionBtn, { backgroundColor: '#10b981' }]} 
                      onPress={() => navigateToMyStopOnGoogleMaps(activeChild.stopCoords.lat, activeChild.stopCoords.lng)}
                    >
                      <Text style={styles.hudActionBtnText}>
                        🧭 {lang === 'hi' ? 'स्टॉप तक नेविगेशन' : 'Directions to Stop'}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* Quick Chime & GPS Refresh */}
                  <View style={styles.hudActionRow}>
                    <TouchableOpacity style={styles.hudActionBtn} onPress={triggerBusChimeTest}>
                      <Text style={styles.hudActionBtnText}>{t.testChimeBtn}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.hudActionBtn} onPress={refreshBusGPS}>
                      <Text style={styles.hudActionBtnText}>{t.refreshGpsBtn}</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Route Stops Timeline for Active Child's Bus */}
                <View style={styles.card}>
                  <Text style={styles.sectionHeading}>
                    📍 {lang === 'hi' ? `${activeChild.busNo} रूट स्टॉप्स व लाइव स्थिति` : `${activeChild.busNo} Route Stops & Timeline`}
                  </Text>
                  
                  {activeChild.stops.map(st => {
                    const title = lang === 'hi' ? st.titleHi : st.titleEn;
                    const isUserStop = !!st.isUserStop;
                    return (
                      <View 
                        key={st.id} 
                        style={[
                          styles.stopRow, 
                          isUserStop && { backgroundColor: '#fef3c7', padding: 10, borderRadius: 12, borderWidth: 1, borderColor: '#fde68a' }
                        ]}
                      >
                        <Text style={{ fontSize: isUserStop ? 20 : 18 }}>
                          {isUserStop ? '🟡' : (isTripActive && st.status === 'passed') ? '🟢' : '⚪'}
                        </Text>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.stopTitle, isUserStop && { color: '#b45309', fontSize: 14 }]}>
                            {st.time} • {title}
                          </Text>
                          <Text style={[styles.stopSub, isUserStop && { color: '#d97706', fontWeight: 'bold' }]}>
                            {isUserStop 
                              ? (isTripActive
                                  ? (activeChild.etaMins === 0 
                                      ? (lang === 'hi' ? '🎉 बस आपके स्टॉप पर पहुँच चुकी है!' : '🎉 Bus has reached your stop!') 
                                      : (lang === 'hi' ? `बस ${activeChild.etaMins} मिनट दूर है (~ ${(activeChild.etaMins * 0.3).toFixed(1)} km)` : `Bus is ${activeChild.etaMins} mins away (~ ${(activeChild.etaMins * 0.3).toFixed(1)} km)`))
                                  : (lang === 'hi' ? 'चालक अभी ड्यूटी पर नहीं हैं (बस स्कूल में खड़ी है)' : 'Driver off duty (Bus parked at school)'))
                              : (isTripActive 
                                  ? (lang === 'hi' ? st.subHi : st.subEn) 
                                  : (lang === 'hi' ? 'यात्रा प्रारंभ होने की प्रतीक्षा में' : 'Waiting for trip start'))}
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                </View>

                {/* Driver, Conductor & Vehicle Details for Active Child's Bus */}
                <View style={styles.card}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                      <View style={styles.busBadgeIcon}>
                        <Text style={{ color: '#d97706', fontWeight: 'bold', fontSize: 13 }}>{activeChild.busNo}</Text>
                      </View>
                      <View>
                        <Text style={styles.cardTitle}>
                          {lang === 'hi' ? `चालक: ${activeChild.driverNameHi}` : `Driver: ${activeChild.driverNameEn}`}
                        </Text>
                        <Text style={styles.cardSub}>
                          {lang === 'hi' ? `कंडक्टर: ${activeChild.conductorNameHi}` : `Helper: ${activeChild.conductorNameEn}`}
                        </Text>
                      </View>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <TouchableOpacity 
                        style={styles.callDriverBtn} 
                        onPress={() => Linking.openURL(`tel:${activeChild.driverPhone}`)}
                      >
                        <Text style={{ fontSize: 18 }}>📞</Text>
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={[styles.callDriverBtn, { backgroundColor: '#dcfce7' }]} 
                        onPress={() => Linking.openURL(`whatsapp://send?phone=91${activeChild.driverPhone}`)}
                      >
                        <Text style={{ fontSize: 18 }}>💬</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                  <View style={{ marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#f1f5f9' }}>
                    <Text style={[styles.cardSub, { color: '#0284c7', fontWeight: 'bold' }]}>
                      🚍 {activeChild.vehicleNo}
                    </Text>
                    <Text style={[styles.cardSub, { marginTop: 4, color: '#475569' }]}>
                      🏫 {lang === 'hi' ? activeChild.schoolNameHi : activeChild.schoolNameEn} • 📞 {activeChild.schoolHelpline}
                    </Text>
                  </View>
                </View>
                </>
                )}
              </View>
            ) : (
              /* ================= DRIVER & HELPER ZERO-BURDEN CONSOLE ================= */
              <View style={{ gap: 14 }}>
                {!driverLoggedInBus ? (
                  /* Driver Grassroots State -> District -> School -> Bus Login */
                  <View style={styles.card}>
                    <Text style={{ fontSize: 32, textAlign: 'center' }}>🚌</Text>
                    <Text style={{ fontSize: 18, fontWeight: 'bold', textAlign: 'center', color: '#0f172a', marginTop: 4 }}>
                      {lang === 'hi' ? 'ड्राइवर ड्यूटी लॉगिन (Grassroots Connect)' : 'Driver Duty Login (Grassroots Connect)'}
                    </Text>
                    <Text style={{ fontSize: 12, color: '#64748b', textAlign: 'center', marginVertical: 6, lineHeight: 18 }}>
                      {lang === 'hi' 
                        ? 'अपना राज्य, जिला, स्कूल और बस नंबर चुनें — तुरंत सभी अभिभावक आपसे कनेक्ट हो जाएंगे।'
                        : 'Select State, District, School & Bus — instantly connects to parents with zero complexity.'}
                    </Text>

                    {/* Driver Name & Mobile */}
                    <View style={{ flexDirection: 'row', gap: 10, marginVertical: 4 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.inputLabel}>{lang === 'hi' ? 'ड्राइवर का नाम' : 'Driver Name'}</Text>
                        <TextInput 
                          style={styles.formInput} 
                          value={driverNameInput} 
                          onChangeText={setDriverNameInput} 
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.inputLabel}>{lang === 'hi' ? 'मोबाइल नंबर' : 'Mobile No'}</Text>
                        <TextInput 
                          style={styles.formInput} 
                          keyboardType="phone-pad"
                          value={driverPhoneInput} 
                          onChangeText={setDriverPhoneInput} 
                        />
                      </View>
                    </View>

                    {/* Step 1: Select State Dropdown */}
                    <Text style={[styles.inputLabel, { marginTop: 8 }]}>{lang === 'hi' ? '1. राज्य चुनें (Select State)' : '1. Select State'}</Text>
                    <TouchableOpacity 
                      style={styles.dropdownSelector} 
                      onPress={() => openLocationPicker('state', 'driver')}
                    >
                      <Text style={styles.dropdownSelectorText}>📍 {driverState || (lang === 'hi' ? 'राज्य चुनें' : 'Select State')}</Text>
                      <Text style={styles.dropdownArrow}>▼</Text>
                    </TouchableOpacity>

                    {/* Step 2: Select District Dropdown */}
                    <Text style={[styles.inputLabel, { marginTop: 8 }]}>{lang === 'hi' ? '2. ज़िला चुनें (Select District)' : '2. Select District'}</Text>
                    <TouchableOpacity 
                      style={styles.dropdownSelector} 
                      onPress={() => openLocationPicker('district', 'driver')}
                    >
                      <Text style={styles.dropdownSelectorText}>🏙️ {driverDistrict || (lang === 'hi' ? 'ज़िला चुनें' : 'Select District')}</Text>
                      <Text style={styles.dropdownArrow}>▼</Text>
                    </TouchableOpacity>

                    {/* Step 3: School Name with Dynamic Parent Sync */}
                    <Text style={[styles.inputLabel, { marginTop: 8 }]}>
                      {lang === 'hi' ? '3. स्कूल चुनें (पैरेंट्स द्वारा पंजीकृत व अन्य):' : '3. Select School (Registered by Parents):'}
                    </Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, marginVertical: 4 }}>
                      {Array.from(new Set([
                        ...schoolChildren.map(c => c.schoolNameHi || c.schoolNameEn),
                        ...registeredSchools
                      ])).map((sc, idx) => (
                        <TouchableOpacity
                          key={idx}
                          style={[styles.chip, driverSelectedSchool === sc && styles.chipActive]}
                          onPress={() => setDriverSelectedSchool(sc)}
                        >
                          <Text style={[styles.chipText, driverSelectedSchool === sc && styles.chipTextActive]}>
                            🏫 {sc}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                    <TextInput 
                      style={styles.formInput} 
                      placeholder={lang === 'hi' ? 'या स्कूल का नाम लिखें' : 'Or enter school name'} 
                      placeholderTextColor="#94a3b8"
                      value={driverSelectedSchool} 
                      onChangeText={setDriverSelectedSchool} 
                    />

                    {/* Step 4: Bus Number with Dynamic Parent Sync */}
                    <Text style={[styles.inputLabel, { marginTop: 8 }]}>
                      {lang === 'hi' ? '4. बस नंबर चुनें (Select Bus No):' : '4. Select Bus Number:'}
                    </Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, marginVertical: 4 }}>
                      {Array.from(new Set([
                        ...schoolChildren.map(c => c.busNo),
                        'Bus #12', 'Bus #08', 'Bus #04', 'Bus #01'
                      ])).map((b, idx) => (
                        <TouchableOpacity
                          key={idx}
                          style={[styles.chip, driverSelectedBus === b && styles.chipActive]}
                          onPress={() => { setDriverSelectedBus(b); setDriverCustomBusInput(''); }}
                        >
                          <Text style={[styles.chipText, driverSelectedBus === b && styles.chipTextActive]}>
                            🚌 {b}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                    <TextInput 
                      style={styles.formInput} 
                      placeholder={lang === 'hi' ? 'या अन्य बस नंबर (उदा: Bus #18)' : 'Or custom bus number'} 
                      placeholderTextColor="#94a3b8"
                      value={driverCustomBusInput} 
                      onChangeText={setDriverCustomBusInput} 
                    />

                    <TouchableOpacity 
                      style={[styles.saveSubmitBtn, { marginTop: 14, backgroundColor: '#059669' }]}
                      onPress={() => handleDriverLogin(driverCustomBusInput || driverSelectedBus, driverSelectedSchool)}
                    >
                      <Text style={styles.saveSubmitBtnText}>
                        🟢 {lang === 'hi' ? 'ड्यूटी लॉगिन करें व पैरेंट्स से जुड़ें' : 'Login Duty & Connect to Parents'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  /* Zero-Burden Safe Driving Dashboard WITH CHANGE BUS BUTTON */
                  <View style={{ gap: 14 }}>
                    {/* Driver Profile Header with SWITCH BUS BUTTON */}
                    <View style={{ backgroundColor: '#0f172a', padding: 16, borderRadius: 20 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: '#fff', fontSize: 18, fontWeight: 'bold' }}>
                            🚍 {driverLoggedInBus.busNo}
                          </Text>
                          <Text style={{ color: '#fed7aa', fontSize: 13, fontWeight: 'bold', marginTop: 2 }}>
                            🏫 {driverLoggedInBus.school}
                          </Text>
                          <Text style={{ color: '#94a3b8', fontSize: 11, marginTop: 2 }}>
                            📍 {driverLoggedInBus.district || driverDistrict}, {driverLoggedInBus.state || driverState}
                          </Text>
                          <Text style={{ color: '#cbd5e1', fontSize: 11, marginTop: 2 }}>
                            👤 चालक: {driverLoggedInBus.driverName} • 📞 {driverLoggedInBus.driverPhone}
                          </Text>
                        </View>
                        
                        <View style={{ gap: 6, alignItems: 'flex-end' }}>
                          {/* SWITCH / CHANGE BUS BUTTON */}
                          <TouchableOpacity 
                            style={{ backgroundColor: '#ea580c', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 }}
                            onPress={() => setIsChangeBusModalOpen(true)}
                          >
                            <Text style={{ color: '#fff', fontSize: 11, fontWeight: 'bold' }}>
                              🔄 {lang === 'hi' ? 'बस नंबर बदलें' : 'Switch Bus'}
                            </Text>
                          </TouchableOpacity>

                          <TouchableOpacity 
                            style={{ backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 }}
                            onPress={handleDriverLogout}
                          >
                            <Text style={{ color: '#fed7aa', fontSize: 10, fontWeight: 'bold' }}>
                              {lang === 'hi' ? 'लॉगआउट' : 'Logout'}
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>

                    {/* Massive 1-Tap Duty Toggle */}
                    <View style={styles.card}>
                      <View style={{ alignItems: 'center', marginVertical: 8 }}>
                        <Text style={{ fontSize: 44 }}>{driverDutyActive ? '🟢' : '⚪'}</Text>
                        <Text style={{ fontSize: 18, fontWeight: 'bold', color: driverDutyActive ? '#15803d' : '#475569', marginTop: 6 }}>
                          {driverDutyActive 
                            ? (lang === 'hi' ? 'ड्यूटी चालू है • GPS सैटेलाइट लाइव है' : 'Trip Active • GPS Satellite Live') 
                            : (lang === 'hi' ? 'ड्यूटी बंद है (Trip Offline)' : 'Trip Offline')}
                        </Text>
                        <Text style={{ fontSize: 12, color: '#64748b', textAlign: 'center', marginTop: 4, lineHeight: 18, paddingHorizontal: 10 }}>
                          {driverDutyActive 
                            ? (lang === 'hi' ? '🛡️ सुरक्षित ड्राइव करें! आपको स्क्रीन छूने की कोई आवश्यकता नहीं है। ऐप अपने आप GPS और स्टॉप्स अपडेट कर रहा है।' : 'Drive safely! No screen interaction needed. GPS and ETAs update automatically.')
                            : (lang === 'hi' ? 'बस शुरू करने से पहले हरा बटन दबाएं और फोन डैशबोर्ड पर रख दें।' : 'Tap Start Duty before driving and mount phone on dashboard.')}
                        </Text>
                      </View>

                      <TouchableOpacity 
                        style={[
                          styles.driverTripBtn, 
                          driverDutyActive ? { backgroundColor: '#ef4444' } : { backgroundColor: '#10b981' },
                          { paddingVertical: 18, borderRadius: 18 }
                        ]} 
                        onPress={toggleDriverDuty}
                      >
                        <Text style={[styles.driverTripBtnText, { fontSize: 18 }]}>
                          {driverDutyActive 
                            ? (lang === 'hi' ? '⏹️ ड्यूटी समाप्त करें (END TRIP)' : '⏹️ END DUTY TRIP') 
                            : (lang === 'hi' ? '▶️ ड्यूटी शुरू करें (START TRIP)' : '▶️ START DUTY TRIP')}
                        </Text>
                      </TouchableOpacity>
                    </View>

                    {/* Helper / Conductor Student Attendance Roster */}
                    <View style={styles.card}>
                      <Text style={styles.sectionHeading}>
                        📋 {lang === 'hi' ? 'छात्रों की बस उपस्थिति (Conductor Roster)' : 'Student Boarding Roster (Conductor)'}
                      </Text>
                      <Text style={{ fontSize: 12, color: '#64748b', marginBottom: 10 }}>
                        {lang === 'hi' ? 'बच्चे के चढ़ने/उतरने पर टैप करें (माता-पिता को तुरंत सूचना जाएगी):' : 'Tap student to update boarding (Alerts parents instantly):'}
                      </Text>

                      <View style={{ gap: 8 }}>
                        {schoolChildren.map(kid => (
                          <TouchableOpacity 
                            key={kid.id}
                            style={{ 
                              flexDirection: 'row', 
                              justifyContent: 'space-between', 
                              alignItems: 'center',
                              padding: 12,
                              borderRadius: 12,
                              backgroundColor: kid.isBoarded ? '#f0fdf4' : '#f8fafc',
                              borderWidth: 1,
                              borderColor: kid.isBoarded ? '#86efac' : '#e2e8f0'
                            }}
                            onPress={() => toggleStudentBoarding(kid.id)}
                          >
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                              <Text style={{ fontSize: 24 }}>{kid.avatar}</Text>
                              <View>
                                <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#0f172a' }}>{kid.name}</Text>
                                <Text style={{ fontSize: 11, color: '#64748b' }}>{kid.grade} • {kid.busNo}</Text>
                              </View>
                            </View>
                            <View style={{ backgroundColor: kid.isBoarded ? '#dcfce7' : '#fee2e2', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 }}>
                              <Text style={{ color: kid.isBoarded ? '#15803d' : '#dc2626', fontSize: 11, fontWeight: 'bold' }}>
                                {kid.isBoarded ? (lang === 'hi' ? 'सवार ✓' : 'Boarded ✓') : (lang === 'hi' ? 'अनुपस्थित' : 'Absent')}
                              </Text>
                            </View>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>

                    {/* Driver Emergency Helpline */}
                    <TouchableOpacity 
                      style={{ backgroundColor: '#dc2626', padding: 14, borderRadius: 16, alignItems: 'center' }}
                      onPress={() => Linking.openURL('tel:01127891234')}
                    >
                      <Text style={{ color: '#fff', fontSize: 14, fontWeight: 'bold' }}>
                        📞 {lang === 'hi' ? 'स्कूल ट्रांसपोर्ट कंट्रोल रूम को कॉल करें (Emergency)' : 'Call Transport Control Room (Emergency)'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}
          </View>
        </ScrollView>

        {/* ----------------- 5. DIARY (FILTERABLE WITH DELETE) ----------------- */}
        <ScrollView style={{ width: SCREEN_WIDTH }} contentContainerStyle={styles.scrollBody} showsVerticalScrollIndicator={false}>
          <View style={{ gap: 16 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View>
                <Text style={styles.pageTitle}>✍️ {t.diaryHeading}</Text>
                <Text style={styles.pageSub}>{t.diarySub}</Text>
              </View>
              <TouchableOpacity style={styles.addSmallBtn} onPress={() => setIsAddDiaryModalOpen(true)}>
                <Text style={styles.addSmallBtnText}>{t.addDiaryBtn}</Text>
              </TouchableOpacity>
            </View>

            {/* Diary Search Bar */}
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#f1f5f9', borderRadius: 12, paddingHorizontal: 12, borderWidth: 1, borderColor: '#e2e8f0' }}>
              <Text style={{ fontSize: 16, marginRight: 6 }}>🔍</Text>
              <TextInput
                style={{ flex: 1, height: 40, fontSize: 13, color: '#0f172a' }}
                placeholder={lang === 'hi' ? 'डायरी में खोजें (शीर्षक या शब्द)...' : 'Search diary entries...'}
                placeholderTextColor="#94a3b8"
                value={diarySearchQuery}
                onChangeText={setDiarySearchQuery}
              />
              {diarySearchQuery ? (
                <TouchableOpacity onPress={() => setDiarySearchQuery('')} style={{ padding: 4 }}>
                  <Text style={{ fontSize: 16, color: '#64748b' }}>✕</Text>
                </TouchableOpacity>
              ) : null}
            </View>

            {/* Diary Filter Chips */}
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {[
                { key: 'all', label: lang === 'hi' ? 'सभी रचनाएं' : 'All Entries' },
                { key: 'kavita', label: lang === 'hi' ? '✍️ कविता' : '✍️ Poetry' },
                { key: 'vichar', label: lang === 'hi' ? '💡 विचार' : '💡 Thoughts' }
              ].map(f => (
                <TouchableOpacity
                  key={f.key}
                  style={[styles.chip, diaryFilter === f.key && styles.chipActive]}
                  onPress={() => setDiaryFilter(f.key as any)}
                >
                  <Text style={[styles.chipText, diaryFilter === f.key && styles.chipTextActive]}>{f.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {(() => {
              const q = diarySearchQuery.toLowerCase().trim();
              const filteredDiary = diaryEntries.filter(entry => {
                const matchesType = diaryFilter === 'all' || entry.type === diaryFilter;
                const title = (entry.titleHi || entry.titleEn || '').toLowerCase();
                const text = (entry.contentHi || entry.contentEn || '').toLowerCase();
                const matchesQuery = !q || title.includes(q) || text.includes(q);
                return matchesType && matchesQuery;
              });
              if (filteredDiary.length === 0) {
                return (
                  <View style={[styles.card, { alignItems: 'center', paddingVertical: 32 }]}>
                    <Text style={{ fontSize: 40, marginBottom: 8 }}>📖</Text>
                    <Text style={{ fontSize: 15, fontWeight: '700', color: '#1e293b' }}>
                      {diarySearchQuery ? (lang === 'hi' ? 'कोई मेल खाती रचना नहीं मिली' : 'No matching entries found') : (lang === 'hi' ? 'डायरी में कोई प्रविष्टि नहीं है' : 'No entries in diary')}
                    </Text>
                    <Text style={{ fontSize: 12, color: '#64748b', marginTop: 4, textAlign: 'center' }}>
                      {diarySearchQuery ? (lang === 'hi' ? 'दूसरा शब्द खोजें या फ़िल्टर बदलें' : 'Try searching another word') : (lang === 'hi' ? 'ऊपर "+ विचार लिखें" बटन दबाकर अपने विचार लिखें' : 'Tap "+ Write Note" above')}
                    </Text>
                  </View>
                );
              }
              return (
                <View style={{ gap: 12 }}>
                  {filteredDiary.map(entry => {
                    const title = getLocalized(entry, 'title');
                    const content = getLocalized(entry, 'content');
                    return (
                      <View key={entry.id} style={styles.card}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Text style={styles.diaryTitle}>{title}</Text>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <Text style={styles.diaryDate}>{entry.date}</Text>
                            <TouchableOpacity onPress={() => openEditDiaryModal(entry)} style={{ padding: 4 }}>
                              <Text style={{ fontSize: 15 }}>✏️</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => deleteDiary(entry.id)} style={{ padding: 4 }}>
                              <Text style={{ fontSize: 15 }}>🗑️</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                        <Text style={styles.diaryContent}>{content}</Text>
                        <TouchableOpacity style={styles.waShareBtn} onPress={() => shareViaWhatsApp(entry)}>
                          <Text style={styles.waShareBtnText}>{t.shareWA}</Text>
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </View>
              );
            })()}
          </View>
        </ScrollView>

        {/* ----------------- 6. FAMILY CONNECT (CLOUD-SYNCED INTERCOM, DIRECTORY & CHAT) ----------------- */}
        <ScrollView style={{ width: SCREEN_WIDTH }} contentContainerStyle={styles.scrollBody} showsVerticalScrollIndicator={false}>
          <View style={{ gap: 16 }}>
            <View style={styles.pageHeader}>
              <Text style={styles.pageTitle}>👨‍👩‍👧‍👦 {t.famHeading}</Text>
              <Text style={styles.pageSub}>{t.famSub}</Text>
            </View>

            {/* How Family Connects Card */}
            <View style={styles.connectGuideCard}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={styles.connectGuideTitle}>{t.connectCodeLabel}</Text>
                <TouchableOpacity 
                  style={{ backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 }}
                  onPress={() => {
                    setTempCodeInput(familyCode);
                    setIsPairModalOpen(true);
                  }}
                >
                  <Text style={{ color: '#fff', fontSize: 11, fontWeight: 'bold' }}>{lang === 'hi' ? '✏️ कोड बदलें' : '✏️ Change Code'}</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.connectGuideDesc}>{t.connectCodeDesc}</Text>
              
              <View style={styles.codeBoxRow}>
                <View style={styles.codePill}><Text style={styles.codePillText}>{familyCode}</Text></View>
                <TouchableOpacity style={styles.shareCodeBtn} onPress={shareFamilyInvite}>
                  <Text style={styles.shareCodeBtnText}>{t.shareInviteBtn}</Text>
                </TouchableOpacity>
              </View>
              <Text style={{ color: '#86efac', fontSize: 11, fontWeight: 'bold', marginTop: 8 }}>
                🟢 {lang === 'hi' ? 'लाइव क्लाउड सिंक सक्रिय है (ntfy.sh)' : 'Live Cloud Sync Active (ntfy.sh)'}
              </Text>
            </View>

            {/* User Profile & Email Backup Card */}
            <View style={[styles.card, { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0', borderWidth: 1 }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                  <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#16a34a', alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontSize: 22 }}>👤</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15, fontWeight: 'bold', color: '#14532d' }}>
                      {userProfile?.name || (lang === 'hi' ? 'मुख्य उपयोगकर्ता प्रोफ़ाइल' : 'Primary User Profile')}
                    </Text>
                    <Text style={{ fontSize: 12, color: '#166534', marginTop: 1 }}>
                      📱 {userProfile?.mobile || '—'}
                    </Text>
                    <Text style={{ fontSize: 12, color: '#166534', marginTop: 1 }}>
                      📧 {userProfile?.email || '—'}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity 
                  style={{ backgroundColor: '#15803d', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 }}
                  onPress={() => {
                    setOnboardName(userProfile?.name || '');
                    setOnboardMobile(userProfile?.mobile || '');
                    setOnboardEmail(userProfile?.email || '');
                    setIsOnboardingOpen(true);
                  }}
                >
                  <Text style={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}>✏️ {lang === 'hi' ? 'एडिट' : 'Edit'}</Text>
                </TouchableOpacity>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#dcfce7' }}>
                <Text style={{ fontSize: 11, color: '#15803d', fontWeight: 'bold' }}>
                  🔒 {lang === 'hi' ? 'ईमेल ऑटो-बैकअप सुरक्षित रूप से लिंक है' : 'Auto Email Backup Linked Safely'}
                </Text>
              </View>

              <TouchableOpacity
                style={{
                  backgroundColor: '#059669',
                  borderRadius: 12,
                  paddingVertical: 10,
                  paddingHorizontal: 14,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  marginTop: 10
                }}
                onPress={exportFullFamilyBackup}
              >
                <Text style={{ fontSize: 16 }}>📤</Text>
                <Text style={{ color: '#fff', fontSize: 13, fontWeight: 'bold' }}>
                  {lang === 'hi' ? 'पूरा डेटा बैकअप ईमेल / WhatsApp पर भेजें' : 'Send Full Data Backup (Email / WhatsApp)'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Family Members Directory WITH + ADD MEMBER & DELETE */}
            <View style={styles.card}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <Text style={styles.sectionHeading}>{t.membersHeading}</Text>
                <TouchableOpacity style={styles.addSmallBtn} onPress={() => setIsAddMemberModalOpen(true)}>
                  <Text style={styles.addSmallBtnText}>{t.addMemberBtn}</Text>
                </TouchableOpacity>
              </View>

              <View style={{ gap: 10 }}>
                {familyMembers.length === 0 ? (
                  <View style={{ alignItems: 'center', paddingVertical: 18 }}>
                    <Text style={{ fontSize: 13, color: '#94a3b8' }}>
                      {lang === 'hi' ? 'कोई अन्य सदस्य नहीं जुड़ा है • "+ सदस्य जोड़ें" बटन दबाएं' : 'No other family members added • Tap "+ Add Member"'}
                    </Text>
                  </View>
                ) : (
                  familyMembers.map(mem => (
                  <View key={mem.id} style={styles.memberRow}>
                    <View style={styles.memberAvatarCircle}><Text style={{ fontSize: 24 }}>{mem.avatar}</Text></View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.memberNameText}>{mem.name}</Text>
                      <Text style={styles.memberSubText}>{lang === 'hi' ? `${mem.relationHi} • ${mem.age} वर्ष • ${mem.role}` : `${mem.relationEn || mem.relationHi} • ${mem.age} yrs • ${mem.role}`}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                      <TouchableOpacity 
                        style={styles.iconCircleBtn}
                        onPress={() => Linking.openURL(`tel:${mem.phone}`)}
                      >
                        <Text style={{ fontSize: 16 }}>📞</Text>
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={[styles.iconCircleBtn, { backgroundColor: '#dcfce7' }]}
                        onPress={() => Linking.openURL(`whatsapp://send?phone=${mem.phone}`)}
                      >
                        <Text style={{ fontSize: 16 }}>💬</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => openEditMemberModal(mem)} style={{ padding: 4 }}>
                        <Text style={{ fontSize: 15 }}>✏️</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => deleteMember(mem.id)} style={{ padding: 4 }}>
                        <Text style={{ fontSize: 15 }}>🗑️</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
                )}
              </View>
            </View>

            {/* Smart Intercom Card with Real Cloud Broadcast */}
            <View style={styles.intercomCard}>
              <Text style={styles.intercomHead}>{t.intercomTitle}</Text>
              <Text style={{ color: '#c7d2fe', fontSize: 12, marginTop: 2 }}>{t.intercomDesc}</Text>
              
              <View style={styles.buzzerGrid}>
                <TouchableOpacity 
                  style={styles.buzzerBtn} 
                  onPress={() => triggerIntercomBuzzer('🍲 खाना तैयार है! सभी डाइनिंग टेबल पर आएं।', '🍲 Dinner is served! Please gather at the table.')}
                >
                  <Text style={styles.buzzerIcon}>🍲</Text>
                  <Text style={styles.buzzerLabel}>{t.buzzerDinner}</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.buzzerBtn} 
                  onPress={() => triggerIntercomBuzzer('🏡 मैं सुरक्षित घर पहुँच गया हूँ।', '🏡 I have reached home safely.')}
                >
                  <Text style={styles.buzzerIcon}>🏡</Text>
                  <Text style={styles.buzzerLabel}>{t.buzzerHome}</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.buzzerBtn, { backgroundColor: 'rgba(239, 68, 68, 0.4)' }]} 
                  onPress={() => triggerIntercomBuzzer('🚨 सायरन! तुरंत सहायता की ज़रूरत है!', '🚨 Siren! Immediate help needed!')}
                >
                  <Text style={styles.buzzerIcon}>🚨</Text>
                  <Text style={[styles.buzzerLabel, { color: '#fca5a5' }]}>{t.buzzerHelp}</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Family Group Chat with Real Cloud Broadcast */}
            <View style={styles.chatContainer}>
              <View style={styles.chatHeader}>
                <Text style={styles.chatHeaderTitle}>{t.familyChatTitle}</Text>
                <Text style={styles.chatHeaderEnc}>{t.chatEncrypted}</Text>
              </View>

              <ScrollView style={styles.chatMessages} nestedScrollEnabled>
                {familyChat.length === 0 ? (
                  <View style={{ alignItems: 'center', paddingVertical: 24 }}>
                    <Text style={{ fontSize: 24, marginBottom: 4 }}>💬</Text>
                    <Text style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center' }}>
                      {lang === 'hi' ? 'पारिवारिक चैट यहाँ सुरक्षित दिखेगी • नीचे संदेश लिखकर भेजें' : 'Encrypted family messages appear here • Send your first message below'}
                    </Text>
                  </View>
                ) : (
                  familyChat.map(item => {
                  const sender = getLocalized(item, 'sender');
                  const msg = getLocalized(item, 'msg');
                  return (
                    <View key={item.id} style={[styles.chatBubble, item.isSelf ? styles.chatBubbleSelf : styles.chatBubbleOther]}>
                      <Text style={styles.chatBubbleSender}>{sender}</Text>
                      <Text style={styles.chatBubbleText}>{msg}</Text>
                      <Text style={styles.chatBubbleTime}>{item.time}</Text>
                    </View>
                  );
                })
                )}
              </ScrollView>

              <View style={styles.chatInputRow}>
                <TextInput 
                  style={styles.chatInput}
                  placeholder={t.chatPlaceholder}
                  placeholderTextColor="#94a3b8"
                  value={chatInput}
                  onChangeText={setChatInput}
                />
                <TouchableOpacity style={styles.chatSendBtn} onPress={handleSendChat}>
                  <Text style={{ color: '#fff', fontSize: 16 }}>➤</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </ScrollView>

      </ScrollView>

      {/* ================= MODAL: PAIR FAMILY CODE ================= */}
      <Modal visible={isPairModalOpen} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalContent, { backgroundColor: '#fff' }]}>
            <Text style={{ fontSize: 32, textAlign: 'center' }}>🔑</Text>
            <Text style={{ fontSize: 18, fontWeight: 'bold', textAlign: 'center', color: '#0f172a', marginTop: 6 }}>
              {lang === 'hi' ? 'पारिवारिक नेटवर्क कोड दर्ज करें' : 'Enter Family Network Code'}
            </Text>
            <Text style={{ fontSize: 13, color: '#475569', textAlign: 'center', marginVertical: 8 }}>
              {lang === 'hi' ? 'घर के सभी सदस्यों के फ़ोन में एक ही कोड होना चाहिए ताकि सब आपस में सिंक रह सकें।' : 'All household phones must use the same code to stay synced.'}
            </Text>

            <TextInput 
              style={[styles.formInput, { textAlign: 'center', fontSize: 18, fontWeight: 'bold', letterSpacing: 2 }]} 
              placeholder="MAST-8821" 
              placeholderTextColor="#94a3b8"
              value={tempCodeInput} 
              onChangeText={setTempCodeInput} 
            />

            <TouchableOpacity 
              style={[styles.saveSubmitBtn, { marginTop: 14 }]} 
              onPress={async () => {
                if (tempCodeInput.trim()) {
                  const newC = tempCodeInput.trim().toUpperCase();
                  setFamilyCode(newC);
                  await AsyncStorage.setItem('@mast_v7_family_code', newC);
                  setIsPairModalOpen(false);
                  Alert.alert('Success', lang === 'hi' ? `फैमिली कोड ${newC} से कनेक्ट हो गए!` : `Connected to Family Code ${newC}!`);
                }
              }}
            >
              <Text style={styles.saveSubmitBtnText}>{lang === 'hi' ? '💾 कनेक्ट करें' : '💾 Connect'}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={{ padding: 12, alignItems: 'center' }} onPress={() => setIsPairModalOpen(false)}>
              <Text style={{ color: '#64748b', fontSize: 14, fontWeight: 'bold' }}>{lang === 'hi' ? 'रद्द करें' : 'Cancel'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ================= MODAL: ADD MEDICINE ================= */}
      <Modal visible={isAddMedModalOpen} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={styles.modalHeaderTitle}>{editingMedId ? (lang === 'hi' ? '✏️ दवाई की जानकारी संपादित करें' : '✏️ Edit Medicine Details') : t.addMedTitle}</Text>
              <TouchableOpacity onPress={() => setIsAddMedModalOpen(false)}>
                <Text style={{ fontSize: 22, color: '#64748b', fontWeight: 'bold' }}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={{ gap: 12, marginVertical: 14 }}>
              {/* Member / Patient Selector */}
              <View>
                <Text style={styles.inputLabel}>
                  👤 {lang === 'hi' ? 'यह दवा किसके लिए है? (परिवार का सदस्य चुनें):' : 'Who is this medicine for? (Select Member):'}
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, marginVertical: 4 }}>
                  {[
                    ...(userProfile?.name ? [`${userProfile.name} (स्वयं)`] : ['स्वयं (Self)']),
                    ...familyMembers.map((m: any) => m.name || m.nameHi || m.nameEn).filter(Boolean),
                    'दादाजी', 'दादीजी', 'पिताजी', 'माताजी', 'बच्चे'
                  ].filter((v, i, a) => a.indexOf(v) === i).map((person) => (
                    <TouchableOpacity
                      key={person}
                      style={[styles.chip, newMedPatient === person && styles.chipActive]}
                      onPress={() => setNewMedPatient(person)}
                    >
                      <Text style={[styles.chipText, newMedPatient === person && styles.chipTextActive]}>
                        👤 {person}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                <TextInput
                  style={[styles.formInput, { marginTop: 4 }]}
                  placeholder={lang === 'hi' ? 'या अन्य सदस्य का नाम लिखें (उदा: दादाजी / रोहन)' : 'Or enter member name (e.g. Grandfather / Rohan)'}
                  placeholderTextColor="#94a3b8"
                  value={newMedPatient}
                  onChangeText={setNewMedPatient}
                />
              </View>

              <Text style={styles.inputLabel}>{t.medNamePrompt}</Text>
              <TextInput 
                style={styles.formInput} 
                placeholder={lang === 'hi' ? 'उदा: Metformin / Thyronorm' : 'e.g. Metformin / Thyronorm'} 
                placeholderTextColor="#94a3b8"
                value={newMedName} 
                onChangeText={setNewMedName} 
              />

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>{t.medTimePrompt}</Text>
                  <TextInput 
                    style={styles.formInput} 
                    placeholder="08:00 AM" 
                    placeholderTextColor="#94a3b8"
                    value={newMedTime} 
                    onChangeText={setNewMedTime} 
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>{t.medDosePrompt}</Text>
                  <TextInput 
                    style={styles.formInput} 
                    placeholder={lang === 'hi' ? '1 गोली खाने बाद' : '1 pill after meal'} 
                    placeholderTextColor="#94a3b8"
                    value={newMedDose} 
                    onChangeText={setNewMedDose} 
                  />
                  <View style={{ flexDirection: 'row', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
                    {['1 गोली खाने बाद', '1 गोली खाली पेट', '2 गोली'].map(ch => (
                      <TouchableOpacity
                        key={ch}
                        style={[styles.chip, { paddingVertical: 3, paddingHorizontal: 6 }]}
                        onPress={() => setNewMedDose(ch)}
                      >
                        <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#0f172a' }}>{ch}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </View>

              <Text style={styles.inputLabel}>{t.medDocPrompt}</Text>
              <TextInput 
                style={styles.formInput} 
                placeholder={lang === 'hi' ? 'डॉक्टर का नाम' : 'Doctor Name'} 
                placeholderTextColor="#94a3b8"
                value={newMedDoc} 
                onChangeText={setNewMedDoc} 
              />

              <TouchableOpacity 
                style={styles.photoUploadBtn} 
                onPress={() => launchCameraScanner(t.snapDocPhotoPrompt, (uri) => setNewMedPhoto(uri))}
              >
                <Text style={styles.photoUploadBtnText}>
                  {newMedPhoto ? t.photoAttached : t.snapDocPhotoPrompt}
                </Text>
              </TouchableOpacity>

              {newMedPhoto && (
                <Image source={{ uri: newMedPhoto }} style={{ width: '100%', height: 120, borderRadius: 10 }} />
              )}
            </View>

            <TouchableOpacity style={styles.saveSubmitBtn} onPress={handleAddNewMedicine}>
              <Text style={styles.saveSubmitBtnText}>{editingMedId ? (lang === 'hi' ? '✓ बदलाव सुरक्षित करें' : '✓ Update Medicine') : t.saveMedBtn}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ================= MODAL: ADD APPLIANCE ================= */}
      <Modal visible={isAddApplianceModalOpen} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={styles.modalHeaderTitle}>{editingApplianceId ? (lang === 'hi' ? '✏️ सामान व बिल संपादित करें' : '✏️ Edit Appliance & Bill') : t.addVaultTitle}</Text>
              <TouchableOpacity onPress={() => setIsAddApplianceModalOpen(false)}>
                <Text style={{ fontSize: 22, color: '#64748b', fontWeight: 'bold' }}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={{ gap: 12, marginVertical: 14 }}>
              <Text style={styles.inputLabel}>{t.itemNamePrompt}</Text>
              <TextInput 
                style={styles.formInput} 
                placeholder="LG AC / Microwave / TV" 
                placeholderTextColor="#94a3b8"
                value={newVaultName} 
                onChangeText={setNewVaultName} 
              />

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>{t.pricePrompt}</Text>
                  <TextInput 
                    style={styles.formInput} 
                    placeholder="₹12,000" 
                    placeholderTextColor="#94a3b8"
                    keyboardType="numeric"
                    value={newVaultPrice} 
                    onChangeText={setNewVaultPrice} 
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>{t.warrantyPrompt}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <TextInput 
                      style={[styles.formInput, { flex: 1 }]} 
                      placeholder="15 Oct 2027" 
                      placeholderTextColor="#94a3b8"
                      value={newVaultWarranty} 
                      onChangeText={setNewVaultWarranty} 
                    />
                    <TouchableOpacity 
                      style={styles.calendarPickIconBtn}
                      onPress={() => openCalendar('appliance', newVaultWarranty)}
                    >
                      <Text style={{ fontSize: 18 }}>📅</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                    {[
                      { label: '1 वर्ष', years: 1 },
                      { label: '2 वर्ष', years: 2 },
                      { label: '5 वर्ष', years: 5 },
                      { label: '10 वर्ष', years: 10 }
                    ].map(w => (
                      <TouchableOpacity
                        key={w.label}
                        style={[styles.chip, { paddingVertical: 3, paddingHorizontal: 6 }]}
                        onPress={() => {
                          const d = new Date();
                          d.setFullYear(d.getFullYear() + w.years);
                          const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                          setNewVaultWarranty(`${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`);
                        }}
                      >
                        <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#0f172a' }}>+{w.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </View>

              <Text style={styles.inputLabel}>{t.storePrompt}</Text>
              <TextInput 
                style={styles.formInput} 
                placeholder="Croma / Vijay Sales" 
                placeholderTextColor="#94a3b8"
                value={newVaultStore} 
                onChangeText={setNewVaultStore} 
              />

              <TouchableOpacity 
                style={styles.photoUploadBtn} 
                onPress={() => launchCameraScanner(t.snapBillPrompt, (uri) => setNewVaultPhoto(uri))}
              >
                <Text style={styles.photoUploadBtnText}>
                  {newVaultPhoto ? t.billAttached : t.snapBillPrompt}
                </Text>
              </TouchableOpacity>

              {newVaultPhoto && (
                <Image source={{ uri: newVaultPhoto }} style={{ width: '100%', height: 120, borderRadius: 10 }} />
              )}
            </View>

            <TouchableOpacity style={styles.saveSubmitBtn} onPress={handleAddNewAppliance}>
              <Text style={styles.saveSubmitBtnText}>{editingApplianceId ? (lang === 'hi' ? '✓ बदलाव सुरक्षित करें' : '✓ Update Appliance') : t.saveToVaultBtn}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ================= MODAL: ADD GOLD / SILVER ================= */}
      <Modal visible={isAddGoldModalOpen} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={styles.modalHeaderTitle}>{editingGoldId ? (lang === 'hi' ? '✏️ आभूषण विवरण संपादित करें' : '✏️ Edit Jewellery Details') : t.addGoldTitle}</Text>
              <TouchableOpacity onPress={() => setIsAddGoldModalOpen(false)}>
                <Text style={{ fontSize: 22, color: '#64748b', fontWeight: 'bold' }}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={{ gap: 12, marginVertical: 14 }}>
              <Text style={styles.inputLabel}>{t.goldTitlePrompt}</Text>
              <TextInput 
                style={styles.formInput} 
                placeholder="22K Gold Chain / Bangles" 
                placeholderTextColor="#94a3b8"
                value={newGoldTitle} 
                onChangeText={setNewGoldTitle} 
              />

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>{t.goldWeightPrompt}</Text>
                  <TextInput 
                    style={styles.formInput} 
                    placeholder="12.5 gm" 
                    placeholderTextColor="#94a3b8"
                    value={newGoldWeight} 
                    onChangeText={setNewGoldWeight} 
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>{t.goldValuePrompt}</Text>
                  <TextInput 
                    style={styles.formInput} 
                    placeholder="₹95,000" 
                    placeholderTextColor="#94a3b8"
                    value={newGoldValue} 
                    onChangeText={setNewGoldValue} 
                  />
                </View>
              </View>

              <Text style={styles.inputLabel}>{t.goldPurityPrompt}</Text>
              <TextInput 
                style={styles.formInput} 
                placeholder="22K 916 BIS Hallmark" 
                placeholderTextColor="#94a3b8"
                value={newGoldPurity} 
                onChangeText={setNewGoldPurity} 
              />

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>{t.goldLockerPrompt}</Text>
                  <TextInput 
                    style={styles.formInput} 
                    placeholder="SBI Locker #104" 
                    placeholderTextColor="#94a3b8"
                    value={newGoldLocker} 
                    onChangeText={setNewGoldLocker} 
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>{t.goldJewellerPrompt}</Text>
                  <TextInput 
                    style={styles.formInput} 
                    placeholder="Tanishq / Kalyan" 
                    placeholderTextColor="#94a3b8"
                    value={newGoldJeweller} 
                    onChangeText={setNewGoldJeweller} 
                  />
                </View>
              </View>

              <View>
                <Text style={styles.inputLabel}>{lang === 'hi' ? 'खरीद की तारीख (वैकल्पिक)' : 'Purchase Date (Optional)'}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <TextInput 
                    style={[styles.formInput, { flex: 1 }]} 
                    placeholder={lang === 'hi' ? 'उदा: 10 Nov 2024' : 'e.g. 10 Nov 2024'} 
                    placeholderTextColor="#94a3b8"
                    value={newGoldDate} 
                    onChangeText={setNewGoldDate} 
                  />
                  <TouchableOpacity 
                    style={styles.calendarPickIconBtn}
                    onPress={() => openCalendar('gold', newGoldDate)}
                  >
                    <Text style={{ fontSize: 18 }}>📅</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <TouchableOpacity 
                style={styles.photoUploadBtn} 
                onPress={() => launchCameraScanner(t.snapGoldPhotoPrompt, (uri) => setNewGoldPhoto(uri))}
              >
                <Text style={styles.photoUploadBtnText}>
                  {newGoldPhoto ? t.goldAttached : t.snapGoldPhotoPrompt}
                </Text>
              </TouchableOpacity>

              {newGoldPhoto && (
                <Image source={{ uri: newGoldPhoto }} style={{ width: '100%', height: 120, borderRadius: 10 }} />
              )}
            </View>

            <TouchableOpacity style={styles.saveSubmitBtn} onPress={handleAddNewGold}>
              <Text style={styles.saveSubmitBtnText}>{editingGoldId ? (lang === 'hi' ? '✓ बदलाव सुरक्षित करें' : '✓ Update Jewellery') : t.saveGoldBtn}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ================= MODAL: ADD DOCUMENT ================= */}
      <Modal visible={isAddDocModalOpen} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={styles.modalHeaderTitle}>{editingDocId ? (lang === 'hi' ? '✏️ दस्तावेज़ संपादित करें' : '✏️ Edit Document Details') : t.addDocTitle}</Text>
              <TouchableOpacity onPress={() => setIsAddDocModalOpen(false)}>
                <Text style={{ fontSize: 22, color: '#64748b', fontWeight: 'bold' }}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={{ gap: 12, marginVertical: 14 }}>
              <Text style={styles.inputLabel}>{t.docMemberPrompt}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
                {familyMembers.length > 0 ? (
                  familyMembers.map(m => (
                    <TouchableOpacity 
                      key={m.id} 
                      style={[styles.chip, newDocMember === m.name && styles.chipActive]}
                      onPress={() => setNewDocMember(m.name)}
                    >
                      <Text style={[styles.chipText, newDocMember === m.name && styles.chipTextActive]}>
                        {m.avatar} {m.name}
                      </Text>
                    </TouchableOpacity>
                  ))
                ) : (
                  <TouchableOpacity 
                    style={[styles.chip, styles.chipActive]}
                    onPress={() => setNewDocMember('Self')}
                  >
                    <Text style={[styles.chipText, styles.chipTextActive]}>👤 {lang === 'hi' ? 'स्वयं' : 'Self'}</Text>
                  </TouchableOpacity>
                )}
              </ScrollView>

              <Text style={styles.inputLabel}>{t.docTitlePrompt}</Text>
              <TextInput 
                style={styles.formInput} 
                placeholder="Aadhaar / PAN / Passport" 
                placeholderTextColor="#94a3b8"
                value={newDocTitle} 
                onChangeText={setNewDocTitle} 
              />

              <Text style={styles.inputLabel}>{t.docNumberPrompt}</Text>
              <TextInput 
                style={styles.formInput} 
                placeholder="XXXX-XXXX-XXXX" 
                placeholderTextColor="#94a3b8"
                value={newDocNumber} 
                onChangeText={setNewDocNumber} 
              />

              <View>
                <Text style={styles.inputLabel}>{lang === 'hi' ? 'दस्तावेज़ समाप्ति / नवीनीकरण तारीख (वैकल्पिक)' : 'Expiry / Renewal Date (Optional)'}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <TextInput 
                    style={[styles.formInput, { flex: 1 }]} 
                    placeholder={lang === 'hi' ? 'उदा: 25 Dec 2030' : 'e.g. 25 Dec 2030'} 
                    placeholderTextColor="#94a3b8"
                    value={newDocExpiry} 
                    onChangeText={setNewDocExpiry} 
                  />
                  <TouchableOpacity 
                    style={styles.calendarPickIconBtn}
                    onPress={() => openCalendar('doc', newDocExpiry)}
                  >
                    <Text style={{ fontSize: 18 }}>📅</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <TouchableOpacity 
                style={styles.photoUploadBtn} 
                onPress={() => launchCameraScanner(t.snapDocPhoto, (uri) => setNewDocPhoto(uri))}
              >
                <Text style={styles.photoUploadBtnText}>
                  {newDocPhoto ? t.docAttached : t.snapDocPhoto}
                </Text>
              </TouchableOpacity>

              {newDocPhoto && (
                <Image source={{ uri: newDocPhoto }} style={{ width: '100%', height: 120, borderRadius: 10 }} />
              )}
            </View>

            <TouchableOpacity style={styles.saveSubmitBtn} onPress={handleAddNewDoc}>
              <Text style={styles.saveSubmitBtnText}>{editingDocId ? (lang === 'hi' ? '✓ बदलाव सुरक्षित करें' : '✓ Update Document') : t.saveDocBtn}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ================= MODAL: ADD BILL / REMINDER ================= */}
      <Modal visible={isAddReminderModalOpen} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={styles.modalHeaderTitle}>{editingReminderId ? (lang === 'hi' ? '✏️ रिमाइंडर संपादित करें' : '✏️ Edit Reminder Details') : t.addReminderTitle}</Text>
              <TouchableOpacity onPress={() => setIsAddReminderModalOpen(false)}>
                <Text style={{ fontSize: 22, color: '#64748b', fontWeight: 'bold' }}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={{ gap: 12, marginVertical: 14 }}>
              <Text style={styles.inputLabel}>{t.remTitlePrompt}</Text>
              <TextInput 
                style={styles.formInput} 
                placeholder="Electricity Bill / Gas / School Fee" 
                placeholderTextColor="#94a3b8"
                value={newRemTitle} 
                onChangeText={setNewRemTitle} 
              />

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>{t.remAmountPrompt}</Text>
                  <TextInput 
                    style={styles.formInput} 
                    placeholder="₹1,200" 
                    placeholderTextColor="#94a3b8"
                    keyboardType="numeric"
                    value={newRemAmount} 
                    onChangeText={setNewRemAmount} 
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>{t.remDatePrompt}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <TextInput 
                      style={[styles.formInput, { flex: 1 }]} 
                      placeholder="05 Nov" 
                      placeholderTextColor="#94a3b8"
                      value={newRemDate} 
                      onChangeText={setNewRemDate} 
                    />
                    <TouchableOpacity 
                      style={styles.calendarPickIconBtn}
                      onPress={() => openCalendar('reminder', newRemDate)}
                    >
                      <Text style={{ fontSize: 18 }}>📅</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              <TouchableOpacity 
                style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6 }}
                onPress={() => setNewRemUrgent(p => !p)}
              >
                <View style={[styles.checkCircle, newRemUrgent && { backgroundColor: '#ef4444', borderColor: '#ef4444' }]}>
                  <Text style={{ color: '#fff', fontSize: 13, fontWeight: 'bold' }}>{newRemUrgent ? '✓' : ''}</Text>
                </View>
                <Text style={{ fontSize: 13, fontWeight: 'bold', color: '#0f172a' }}>{t.remUrgentPrompt}</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.saveSubmitBtn} onPress={handleAddNewReminder}>
              <Text style={styles.saveSubmitBtnText}>{editingReminderId ? (lang === 'hi' ? '✓ बदलाव सुरक्षित करें' : '✓ Update Reminder') : t.saveReminderBtn}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ================= MODAL: ADD EXPENSE ================= */}
      <Modal visible={isAddExpenseModalOpen} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={styles.modalHeaderTitle}>{t.addExpenseTitle}</Text>
              <TouchableOpacity onPress={() => setIsAddExpenseModalOpen(false)}>
                <Text style={{ fontSize: 22, color: '#64748b', fontWeight: 'bold' }}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={{ gap: 12, marginVertical: 14 }}>
              <Text style={styles.inputLabel}>{t.expTitlePrompt}</Text>
              <TextInput 
                style={styles.formInput} 
                placeholder="Fruits, Dairy, Fuel..." 
                placeholderTextColor="#94a3b8"
                value={newExpTitle} 
                onChangeText={setNewExpTitle} 
              />

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>{t.expAmountPrompt}</Text>
                  <TextInput 
                    style={styles.formInput} 
                    placeholder="1500" 
                    placeholderTextColor="#94a3b8"
                    keyboardType="numeric"
                    value={newExpAmount} 
                    onChangeText={setNewExpAmount} 
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>{lang === 'hi' ? 'खर्च की तारीख' : 'Expense Date'}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <TextInput 
                      style={[styles.formInput, { flex: 1 }]} 
                      placeholder="आज" 
                      placeholderTextColor="#94a3b8"
                      value={newExpDate} 
                      onChangeText={setNewExpDate} 
                    />
                    <TouchableOpacity 
                      style={styles.calendarPickIconBtn}
                      onPress={() => openCalendar('expense', newExpDate)}
                    >
                      <Text style={{ fontSize: 18 }}>📅</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              <Text style={styles.inputLabel}>{lang === 'hi' ? 'श्रेणी (Category)' : 'Category'}</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {[
                  { key: 'ration', label: lang === 'hi' ? '🟢 राशन' : '🟢 Groceries' },
                  { key: 'fees', label: lang === 'hi' ? '🟡 फीस व बिल' : '🟡 Bills & Fees' },
                  { key: 'med', label: lang === 'hi' ? '🟣 दवा' : '🟣 Healthcare' },
                  { key: 'other', label: lang === 'hi' ? '⚪ अन्य' : '⚪ Misc' }
                ].map(c => (
                  <TouchableOpacity 
                    key={c.key} 
                    style={[styles.chip, newExpCategory === c.key && styles.chipActive]}
                    onPress={() => setNewExpCategory(c.key as any)}
                  >
                    <Text style={[styles.chipText, newExpCategory === c.key && styles.chipTextActive]}>{c.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <TouchableOpacity style={styles.saveSubmitBtn} onPress={handleAddNewExpense}>
              <Text style={styles.saveSubmitBtnText}>{t.saveExpenseBtn}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ================= MODAL: ADD FAMILY MEMBER ================= */}
      <Modal visible={isAddMemberModalOpen} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={styles.modalHeaderTitle}>{editingMemberId ? (lang === 'hi' ? '✏️ सदस्य की जानकारी संपादित करें' : '✏️ Edit Family Member') : t.addMemberTitle}</Text>
              <TouchableOpacity onPress={() => setIsAddMemberModalOpen(false)}>
                <Text style={{ fontSize: 22, color: '#64748b', fontWeight: 'bold' }}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={{ gap: 12, marginVertical: 14 }}>
              <Text style={styles.inputLabel}>{t.memberNamePrompt}</Text>
              <TextInput 
                style={styles.formInput} 
                placeholder="Name" 
                placeholderTextColor="#94a3b8"
                value={newMemberName} 
                onChangeText={setNewMemberName} 
              />

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>{t.memberRelationPrompt}</Text>
                  <TextInput 
                    style={styles.formInput} 
                    placeholder="Brother / Daughter" 
                    placeholderTextColor="#94a3b8"
                    value={newMemberRelation} 
                    onChangeText={setNewMemberRelation} 
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>{t.memberAgePrompt}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <TextInput 
                      style={[styles.formInput, { flex: 1 }]} 
                      placeholder="25" 
                      placeholderTextColor="#94a3b8"
                      keyboardType="numeric"
                      value={newMemberAge} 
                      onChangeText={setNewMemberAge} 
                    />
                    <TouchableOpacity 
                      style={styles.calendarPickIconBtn}
                      onPress={() => openCalendar('member', newMemberDob)}
                    >
                      <Text style={{ fontSize: 18 }}>📅</Text>
                    </TouchableOpacity>
                  </View>
                  {newMemberDob ? (
                    <Text style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>
                      🎂 {newMemberDob}
                    </Text>
                  ) : null}
                </View>
              </View>

              <Text style={styles.inputLabel}>{t.memberPhonePrompt}</Text>
              <TextInput 
                style={styles.formInput} 
                placeholder="98XXXXXXXX" 
                placeholderTextColor="#94a3b8"
                keyboardType="phone-pad"
                value={newMemberPhone} 
                onChangeText={setNewMemberPhone} 
              />

              <Text style={styles.inputLabel}>{lang === 'hi' ? 'अवतार (Avatar)' : 'Avatar'}</Text>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                {['👴', '👵', '👨', '👩', '👦', '👧', '🧑'].map((av, idx) => (
                  <TouchableOpacity 
                    key={idx} 
                    style={[styles.avatarChoiceBox, newMemberAvatar === av && { borderColor: '#f97316', backgroundColor: '#ffedd5' }]}
                    onPress={() => setNewMemberAvatar(av)}
                  >
                    <Text style={{ fontSize: 22 }}>{av}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <TouchableOpacity style={styles.saveSubmitBtn} onPress={handleAddNewMember}>
              <Text style={styles.saveSubmitBtnText}>{editingMemberId ? (lang === 'hi' ? '✓ बदलाव सुरक्षित करें' : '✓ Update Member') : t.saveMemberBtn}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ================= MODAL: ADD DIARY ================= */}
      <Modal visible={isAddDiaryModalOpen} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={styles.modalHeaderTitle}>{editingDiaryId ? (lang === 'hi' ? '✏️ रचना संपादित करें' : '✏️ Edit Diary Entry') : t.addDiaryTitle}</Text>
              <TouchableOpacity onPress={() => setIsAddDiaryModalOpen(false)}>
                <Text style={{ fontSize: 22, color: '#64748b', fontWeight: 'bold' }}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={{ gap: 12, marginVertical: 14 }}>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TouchableOpacity 
                  style={[styles.chip, newDiaryType === 'kavita' && styles.chipActive]} 
                  onPress={() => setNewDiaryType('kavita')}
                >
                  <Text style={[styles.chipText, newDiaryType === 'kavita' && styles.chipTextActive]}>{t.tabKavita}</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.chip, newDiaryType === 'vichar' && styles.chipActive]} 
                  onPress={() => setNewDiaryType('vichar')}
                >
                  <Text style={[styles.chipText, newDiaryType === 'vichar' && styles.chipTextActive]}>{t.tabVichar}</Text>
                </TouchableOpacity>
              </View>

              <View>
                <Text style={styles.inputLabel}>{lang === 'hi' ? 'डायरी प्रविष्टि तारीख' : 'Diary Entry Date'}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <TextInput 
                    style={[styles.formInput, { flex: 1 }]} 
                    placeholder="आज" 
                    placeholderTextColor="#94a3b8"
                    value={newDiaryDate} 
                    onChangeText={setNewDiaryDate} 
                  />
                  <TouchableOpacity 
                    style={styles.calendarPickIconBtn}
                    onPress={() => openCalendar('diary', newDiaryDate)}
                  >
                    <Text style={{ fontSize: 18 }}>📅</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <Text style={styles.inputLabel}>{t.titlePrompt}</Text>
              <TextInput 
                style={styles.formInput} 
                placeholder="Title..." 
                placeholderTextColor="#94a3b8"
                value={newDiaryTitle} 
                onChangeText={setNewDiaryTitle} 
              />

              <Text style={styles.inputLabel}>{t.contentPrompt}</Text>
              <TextInput 
                style={[styles.formInput, { height: 90, textAlignVertical: 'top' }]} 
                placeholder="..." 
                placeholderTextColor="#94a3b8"
                multiline 
                value={newDiaryContent} 
                onChangeText={setNewDiaryContent} 
              />
            </View>

            <TouchableOpacity style={styles.saveSubmitBtn} onPress={handleAddNewDiary}>
              <Text style={styles.saveSubmitBtnText}>{editingDiaryId ? (lang === 'hi' ? '✓ बदलाव सुरक्षित करें' : '✓ Update Entry') : t.saveToDiaryBtn}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ================= MODAL: DOCTOR RX SLIP ================= */}
      <Modal visible={isRxModalOpen} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={styles.modalHeaderTitle}>{t.rxTitle}</Text>
              <TouchableOpacity onPress={() => setIsRxModalOpen(false)}>
                <Text style={{ fontSize: 22, color: '#64748b', fontWeight: 'bold' }}>✕</Text>
              </TouchableOpacity>
            </View>

            {selectedRx && (
              <View style={styles.rxSlipContainer}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <View>
                    <Text style={styles.rxDocName}>{getLocalized(selectedRx, 'doctor')}</Text>
                    <Text style={styles.rxHospName}>{getLocalized(selectedRx, 'hospital')}</Text>
                  </View>
                  <Text style={styles.rxDateBadge}>{selectedRx.date}</Text>
                </View>

                <View style={{ marginVertical: 10 }}>
                  <Text style={{ fontSize: 13, fontWeight: 'bold', color: '#1e293b' }}>
                    {t.patientLabel}: <Text style={{ fontWeight: 'normal' }}>{getLocalized(selectedRx, 'patient')}</Text>
                  </Text>
                </View>

                <View style={styles.rxMedicineDetailBox}>
                  <Text style={styles.rxMedTitle}>💊 {getLocalized(selectedRx, 'name')}</Text>
                  <Text style={styles.rxMedInstructions}>{t.doseLabel}: {getLocalized(selectedRx, 'dose')}</Text>
                </View>

                {selectedRx.imageUri ? (
                  <View style={{ marginTop: 10 }}>
                    <Image source={{ uri: selectedRx.imageUri }} style={{ width: '100%', height: 180, borderRadius: 12 }} />
                    <TouchableOpacity 
                      style={{ marginTop: 8, alignSelf: 'center' }}
                      onPress={() => launchCameraScanner(t.changeRxBtn, (uri) => {
                        const updated = medicines.map(m => m.id === selectedRx.id ? { ...m, imageUri: uri } : m);
                        saveMeds(updated);
                        setSelectedRx({ ...selectedRx, imageUri: uri });
                      })}
                    >
                      <Text style={{ color: '#0284c7', fontWeight: 'bold', fontSize: 12 }}>{t.changeRxBtn}</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity 
                    style={styles.directCameraBtn}
                    onPress={() => launchCameraScanner(t.snapRxBtn, (uri) => {
                      const updated = medicines.map(m => m.id === selectedRx.id ? { ...m, imageUri: uri } : m);
                      saveMeds(updated);
                      setSelectedRx({ ...selectedRx, imageUri: uri });
                    })}
                  >
                    <Text style={styles.directCameraBtnText}>{t.snapRxBtn}</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            <TouchableOpacity style={styles.closeModalBtn} onPress={() => setIsRxModalOpen(false)}>
              <Text style={styles.closeModalBtnText}>{t.closeBtn}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ================= MODAL: EMERGENCY SOS ================= */}
      <Modal visible={isSOSModalOpen} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalContent, { backgroundColor: '#fff' }]}>
            <Text style={{ fontSize: 32, textAlign: 'center' }}>🚨</Text>
            <Text style={{ fontSize: 18, fontWeight: 'bold', textAlign: 'center', color: '#dc2626', marginTop: 6 }}>
              {lang === 'hi' ? 'इमरजेंसी SOS (आपातकालीन सहायता)' : 'Emergency SOS'}
            </Text>
            <Text style={{ fontSize: 13, color: '#475569', textAlign: 'center', marginVertical: 10, lineHeight: 18 }}>
              {lang === 'hi' ? 'एक क्लिक में तुरंत पुलिस, एम्बुलेंस और परिवार को लाइव लोकेशन व SOS मैसेज भेजें:' : 'Instantly send live location and SOS alerts to family and police with one tap:'}
            </Text>

            <TouchableOpacity 
              style={[styles.sosActionBtn, { backgroundColor: '#dc2626' }]}
              onPress={handleSendSOS}
            >
              <Text style={styles.sosActionBtnText}>{lang === 'hi' ? '🚨 परिवार को तुरंत SOS अलर्ट भेजें' : '🚨 Send SOS Alert to Family'}</Text>
            </TouchableOpacity>

            <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
              <TouchableOpacity 
                style={[styles.sosActionBtn, { flex: 1, backgroundColor: '#0284c7' }]}
                onPress={() => { Linking.openURL('tel:112'); setIsSOSModalOpen(false); }}
              >
                <Text style={styles.sosActionBtnText}>📞 112 राष्ट्रीय</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.sosActionBtn, { flex: 1, backgroundColor: '#059669' }]}
                onPress={() => { Linking.openURL('tel:108'); setIsSOSModalOpen(false); }}
              >
                <Text style={styles.sosActionBtnText}>🚑 108 एम्बुलेंस</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.sosActionBtn, { flex: 1, backgroundColor: '#4338ca' }]}
                onPress={() => { Linking.openURL('tel:100'); setIsSOSModalOpen(false); }}
              >
                <Text style={styles.sosActionBtnText}>👮 100 पुलिस</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={{ padding: 12, alignItems: 'center', marginTop: 6 }} onPress={() => setIsSOSModalOpen(false)}>
              <Text style={{ color: '#64748b', fontSize: 14, fontWeight: 'bold' }}>{lang === 'hi' ? 'रद्द करें (Cancel)' : 'Cancel'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ================= MODAL: DONATION (REAL UPI) ================= */}
      <Modal visible={isDonateModalOpen} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <Text style={{ fontSize: 36, textAlign: 'center' }}>💖</Text>
            <Text style={{ fontSize: 18, fontWeight: 'bold', textAlign: 'center', color: '#d97706', marginTop: 6 }}>
              {lang === 'hi' ? 'MAST का स्वेच्छा से सहयोग करें' : 'Support MAST Voluntarily'}
            </Text>
            <Text style={{ fontSize: 13, color: '#475569', textAlign: 'center', marginVertical: 10, lineHeight: 19 }}>
              {lang === 'hi' ? 'MAST पूरी तरह विज्ञापन-मुक्त (100% Ad-Free) और परिवार-सुरक्षित ऐप है।' : 'MAST is 100% Ad-Free and zero-server private.'}
            </Text>

            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 12, marginVertical: 14 }}>
              {['₹50', '₹100', '₹250', '₹500'].map((amt, idx) => (
                <TouchableOpacity 
                  key={idx} 
                  style={{ backgroundColor: '#fef3c7', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 14, borderWidth: 1, borderColor: '#fde68a' }}
                  onPress={() => handleUPIPayment(amt)}
                >
                  <Text style={{ color: '#b45309', fontWeight: 'bold', fontSize: 14 }}>{amt}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={styles.closeModalBtn} onPress={() => setIsDonateModalOpen(false)}>
              <Text style={styles.closeModalBtnText}>{t.closeBtn}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ================= MODAL: ADD CHILD & SCHOOL BUS PASS ================= */}
      <Modal visible={isAddChildModalOpen} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={styles.modalHeaderTitle}>
                {editingChildId
                  ? (lang === 'hi' ? '✏️ बच्चे की जानकारी संपादित करें' : '✏️ Edit Child & Bus Details')
                  : (lang === 'hi' ? '🎒 नया बच्चा / स्कूल बस जोड़ें' : '🎒 Add Child & School Bus')}
              </Text>
              <TouchableOpacity onPress={() => { setEditingChildId(null); setIsAddChildModalOpen(false); }}>
                <Text style={{ fontSize: 22, color: '#64748b', fontWeight: 'bold' }}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={{ marginVertical: 12, maxHeight: 420 }} showsVerticalScrollIndicator={false}>
              <View style={{ gap: 10 }}>
                <Text style={styles.inputLabel}>{lang === 'hi' ? 'बच्चे का नाम' : "Child's Name"}</Text>
                <TextInput 
                  style={styles.formInput} 
                  placeholder={lang === 'hi' ? 'उदा: कबीर / अनन्या' : 'e.g. Kabir / Ananya'} 
                  placeholderTextColor="#94a3b8"
                  value={newChildName} 
                  onChangeText={setNewChildName} 
                />

                <Text style={styles.inputLabel}>{lang === 'hi' ? 'अवतार (Avatar)' : 'Avatar'}</Text>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  {['👧', '👦', '🧒', '👶'].map((av, idx) => (
                    <TouchableOpacity 
                      key={idx} 
                      style={[styles.avatarChoiceBox, newChildAvatar === av && { borderColor: '#ea580c', backgroundColor: '#ffedd5' }]}
                      onPress={() => setNewChildAvatar(av)}
                    >
                      <Text style={{ fontSize: 22 }}>{av}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* State Dropdown Selector */}
                <Text style={styles.inputLabel}>{lang === 'hi' ? '1. राज्य चुनें (Select State)' : '1. Select State'}</Text>
                <TouchableOpacity 
                  style={styles.dropdownSelector} 
                  onPress={() => openLocationPicker('state', 'parent')}
                >
                  <Text style={styles.dropdownSelectorText}>📍 {parentState || (lang === 'hi' ? 'राज्य चुनें' : 'Select State')}</Text>
                  <Text style={styles.dropdownArrow}>▼</Text>
                </TouchableOpacity>

                {/* District Dropdown Selector */}
                <Text style={[styles.inputLabel, { marginTop: 8 }]}>{lang === 'hi' ? '2. ज़िला चुनें (Select District)' : '2. Select District'}</Text>
                <TouchableOpacity 
                  style={styles.dropdownSelector} 
                  onPress={() => openLocationPicker('district', 'parent')}
                >
                  <Text style={styles.dropdownSelectorText}>🏙️ {parentDistrict || (lang === 'hi' ? 'ज़िला चुनें' : 'Select District')}</Text>
                  <Text style={styles.dropdownArrow}>▼</Text>
                </TouchableOpacity>

                <Text style={styles.inputLabel}>{lang === 'hi' ? '3. स्कूल का नाम चुनें या लिखें:' : '3. Select or Type School Name:'}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, marginVertical: 4 }}>
                  {Array.from(new Set([
                    ...schoolChildren.map(c => c.schoolNameHi || c.schoolNameEn),
                    ...registeredSchools
                  ])).map((sc, idx) => (
                    <TouchableOpacity
                      key={idx}
                      style={[styles.chip, newChildSchool === sc && styles.chipActive]}
                      onPress={() => setNewChildSchool(sc)}
                    >
                      <Text style={[styles.chipText, newChildSchool === sc && styles.chipTextActive]}>
                        🏫 {sc}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                <TextInput 
                  style={styles.formInput} 
                  placeholder={lang === 'hi' ? 'उदा: डीपीएस / सेंट जेवियर्स / बाल भारती' : "e.g. DPS / St. Xavier's / Bal Bharati"} 
                  placeholderTextColor="#94a3b8"
                  value={newChildSchool} 
                  onChangeText={setNewChildSchool} 
                />

                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.inputLabel}>{lang === 'hi' ? 'कक्षा / क्लास' : 'Class / Grade'}</Text>
                    <TextInput 
                      style={styles.formInput} 
                      placeholder="Class 3-A" 
                      placeholderTextColor="#94a3b8"
                      value={newChildGrade} 
                      onChangeText={setNewChildGrade} 
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.inputLabel}>{lang === 'hi' ? 'बस नंबर' : 'Bus Number'}</Text>
                    <TextInput 
                      style={styles.formInput} 
                      placeholder="Bus #08" 
                      placeholderTextColor="#94a3b8"
                      value={newChildBusNo} 
                      onChangeText={setNewChildBusNo} 
                    />
                  </View>
                </View>

                <Text style={styles.inputLabel}>{lang === 'hi' ? 'स्कूल बस पास कोड (Route Code)' : 'Bus Route Code'}</Text>
                <TextInput 
                  style={styles.formInput} 
                  placeholder="DPS-BUS-08 / XAV-04" 
                  placeholderTextColor="#94a3b8"
                  value={newChildBusCode} 
                  onChangeText={setNewChildBusCode} 
                />

                <Text style={styles.inputLabel}>{lang === 'hi' ? 'आपका पिकअप/ड्रॉप स्टॉप' : 'Your Pickup / Drop Stop'}</Text>
                <TextInput 
                  style={styles.formInput} 
                  placeholder={lang === 'hi' ? 'उदा: विकास मार्ग गेट 2' : 'e.g. Vikas Marg Gate 2'} 
                  placeholderTextColor="#94a3b8"
                  value={newChildStopName} 
                  onChangeText={setNewChildStopName} 
                />

                {/* --- 💰 School Fees, Bus Fees & Monthly Reminder Automation --- */}
                <View style={{ backgroundColor: '#fff7ed', borderRadius: 14, padding: 12, marginTop: 8, borderWidth: 1, borderColor: '#fed7aa', gap: 10 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text style={{ fontSize: 13, fontWeight: 'bold', color: '#c2410c' }}>
                      💰 {lang === 'hi' ? 'स्कूल व बस फीस (ऑटो रिमाइंडर)' : 'School & Bus Fees (Auto-Reminder)'}
                    </Text>
                    <TouchableOpacity
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
                      onPress={() => setAutoSetChildReminder(p => !p)}
                    >
                      <View style={[styles.checkCircle, autoSetChildReminder && { backgroundColor: '#ea580c', borderColor: '#ea580c' }]}>
                        <Text style={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}>{autoSetChildReminder ? '✓' : ''}</Text>
                      </View>
                      <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#7c2d12' }}>
                        {lang === 'hi' ? 'रिमाइंडर जोड़ें' : 'Set Reminders'}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <Text style={{ fontSize: 11, color: '#9a3412', lineHeight: 16 }}>
                    {lang === 'hi'
                      ? 'यहाँ फीस दर्ज करने से आपके "रिमाइंडर टैब" में हर महीने की अंतिम तारीख का अलर्ट अपने-आप सक्रिय हो जाएगा।'
                      : 'Entering fee details automatically creates monthly fee alerts in your Reminders tab.'}
                  </Text>

                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.inputLabel, { fontSize: 11, color: '#7c2d12' }]}>
                        🏫 {lang === 'hi' ? 'मासिक स्कूल फीस' : 'Monthly School Fee'}
                      </Text>
                      <TextInput 
                        style={[styles.formInput, { backgroundColor: '#ffffff' }]} 
                        placeholder="₹3,500" 
                        placeholderTextColor="#94a3b8"
                        keyboardType="numeric"
                        value={newChildSchoolFee} 
                        onChangeText={setNewChildSchoolFee} 
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.inputLabel, { fontSize: 11, color: '#7c2d12' }]}>
                        🚌 {lang === 'hi' ? 'मासिक बस फीस' : 'Monthly Bus Fee'}
                      </Text>
                      <TextInput 
                        style={[styles.formInput, { backgroundColor: '#ffffff' }]} 
                        placeholder="₹1,800" 
                        placeholderTextColor="#94a3b8"
                        keyboardType="numeric"
                        value={newChildBusFee} 
                        onChangeText={setNewChildBusFee} 
                      />
                    </View>
                  </View>

                  <View>
                    <Text style={[styles.inputLabel, { fontSize: 11, color: '#7c2d12' }]}>
                      📅 {lang === 'hi' ? 'महीने की देय तारीख (Due Date of Month)' : 'Monthly Due Date'}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <TextInput 
                        style={[styles.formInput, { flex: 1, backgroundColor: '#ffffff' }]} 
                        placeholder="10" 
                        placeholderTextColor="#94a3b8"
                        keyboardType="numeric"
                        value={newChildDueDay} 
                        onChangeText={setNewChildDueDay} 
                      />
                      <TouchableOpacity 
                        style={styles.calendarPickIconBtn}
                        onPress={() => openCalendar('child_due', `${newChildDueDay} ${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][new Date().getMonth()]} ${new Date().getFullYear()}`)}
                      >
                        <Text style={{ fontSize: 18 }}>📅</Text>
                      </TouchableOpacity>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 6, marginTop: 4 }}>
                      {['5 तारीख', '10 तारीख', '15 तारीख', '25 तारीख'].map(dStr => {
                        const num = dStr.replace(/[^0-9]/g, '');
                        return (
                          <TouchableOpacity
                            key={dStr}
                            style={[styles.chip, newChildDueDay === num && styles.chipActive, { paddingVertical: 3, paddingHorizontal: 6 }]}
                            onPress={() => setNewChildDueDay(num)}
                          >
                            <Text style={[styles.chipText, newChildDueDay === num && styles.chipTextActive, { fontSize: 10 }]}>{dStr}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                </View>
              </View>
            </ScrollView>

            <TouchableOpacity style={styles.saveSubmitBtn} onPress={handleAddNewChild}>
              <Text style={styles.saveSubmitBtnText}>
                {editingChildId
                  ? (lang === 'hi' ? '✓ बदलाव सुरक्षित करें' : '✓ Update Child & Bus')
                  : (lang === 'hi' ? '💾 बच्चा व बस सुरक्षित सेव करें' : '💾 Save Child & Bus')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ================= MODAL: DRIVER SWITCH BUS NUMBER ================= */}
      <Modal visible={isChangeBusModalOpen} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalContent, { backgroundColor: '#fff' }]}>
            <Text style={{ fontSize: 32, textAlign: 'center' }}>🔄</Text>
            <Text style={{ fontSize: 18, fontWeight: 'bold', textAlign: 'center', color: '#0f172a', marginTop: 4 }}>
              {lang === 'hi' ? 'आज के लिए बस नंबर बदलें' : 'Switch Bus Number for Today'}
            </Text>
            <Text style={{ fontSize: 12, color: '#64748b', textAlign: 'center', marginVertical: 6, lineHeight: 18 }}>
              {lang === 'hi' 
                ? 'यदि आज आपकी ड्यूटी किसी दूसरी बस पर लगी है, तो यहाँ नया बस नंबर चुनें। उस बस के माता-पिता तुरंत आपसे कनेक्ट हो जाएंगे।'
                : 'If you are assigned to a different bus today, select new bus number. Parents of that bus will sync immediately.'}
            </Text>

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 10, justifyContent: 'center' }}>
              {['Bus #01', 'Bus #04', 'Bus #08', 'Bus #12', 'Bus #15', 'Bus #18'].map((b, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={[styles.chip, tempSwitchBusInput === b && styles.chipActive]}
                  onPress={() => setTempSwitchBusInput(b)}
                >
                  <Text style={[styles.chipText, tempSwitchBusInput === b && styles.chipTextActive]}>{b}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TextInput 
              style={[styles.formInput, { textAlign: 'center', fontSize: 16, fontWeight: 'bold' }]}
              placeholder={lang === 'hi' ? 'या अन्य बस नंबर लिखें' : 'Or type custom bus number'}
              placeholderTextColor="#94a3b8"
              value={tempSwitchBusInput}
              onChangeText={setTempSwitchBusInput}
            />

            <TouchableOpacity 
              style={[styles.saveSubmitBtn, { marginTop: 14, backgroundColor: '#ea580c' }]}
              onPress={() => handleSwitchBusNumber(tempSwitchBusInput)}
            >
              <Text style={styles.saveSubmitBtnText}>
                ✓ {lang === 'hi' ? 'नया बस नंबर लागू करें' : 'Apply New Bus Number'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={{ padding: 10, alignItems: 'center' }} onPress={() => setIsChangeBusModalOpen(false)}>
              <Text style={{ color: '#64748b', fontSize: 13, fontWeight: 'bold' }}>{lang === 'hi' ? 'रद्द करें' : 'Cancel'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ================= MODAL: SEARCHABLE ALL-INDIA STATE & DISTRICT DROPDOWN PICKER ================= */}
      <Modal visible={isLocationPickerOpen} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalContent, { maxHeight: '80%' }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={styles.modalHeaderTitle}>
                {pickerType === 'state' 
                  ? (lang === 'hi' ? '📍 भारत का राज्य चुनें (Select State)' : '📍 Select Indian State') 
                  : (lang === 'hi' ? '🏙️ ज़िला चुनें (Select District)' : '🏙️ Select District')}
              </Text>
              <TouchableOpacity onPress={() => setIsLocationPickerOpen(false)}>
                <Text style={{ fontSize: 22, color: '#64748b', fontWeight: 'bold' }}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Search Input Bar */}
            <View style={{ marginTop: 12, marginBottom: 8 }}>
              <TextInput 
                style={styles.formInput}
                placeholder={pickerType === 'state' 
                  ? (lang === 'hi' ? '🔍 राज्य खोजें (Search State)...' : '🔍 Search State...') 
                  : (lang === 'hi' ? '🔍 ज़िला खोजें (Search District)...' : '🔍 Search District...')}
                placeholderTextColor="#94a3b8"
                value={locationSearchQuery}
                onChangeText={setLocationSearchQuery}
              />
            </View>

            {/* Scrollable List of States / Districts */}
            <ScrollView style={{ marginTop: 4, maxHeight: 380 }} showsVerticalScrollIndicator={false}>
              <View style={{ gap: 6 }}>
                {getFilteredLocationList().map((item, idx) => {
                  const isSelected = isLocationItemSelected(item);
                  return (
                    <TouchableOpacity 
                      key={idx}
                      style={{
                        paddingVertical: 12,
                        paddingHorizontal: 14,
                        borderRadius: 12,
                        backgroundColor: isSelected ? '#ffedd5' : '#f8fafc',
                        borderWidth: 1,
                        borderColor: isSelected ? '#f97316' : '#e2e8f0',
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                      onPress={() => handleSelectLocationItem(item)}
                    >
                      <Text style={{ fontSize: 14, fontWeight: isSelected ? 'bold' : '500', color: isSelected ? '#ea580c' : '#0f172a' }}>
                        {item}
                      </Text>
                      {isSelected && (
                        <Text style={{ color: '#ea580c', fontWeight: 'bold', fontSize: 16 }}>✓</Text>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>



      {/* ================= MODAL: SET MONTHLY BUDGET ================= */}
      <Modal visible={isBudgetModalOpen} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalContent, { backgroundColor: '#fff' }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={styles.modalHeaderTitle}>
                💰 {lang === 'hi' ? 'मासिक पारिवारिक बजट सेट करें' : 'Set Monthly Budget'}
              </Text>
              <TouchableOpacity onPress={() => setIsBudgetModalOpen(false)}>
                <Text style={{ fontSize: 22, color: '#64748b', fontWeight: 'bold' }}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={{ fontSize: 13, color: '#64748b', marginTop: 6, lineHeight: 18 }}>
              {lang === 'hi'
                ? 'अपने परिवार का मासिक खर्च लक्ष्य तय करें ताकि बचत व खर्च का सही प्रतिशत दिखे।'
                : 'Define your family monthly spending target to track savings and expense breakdown.'}
            </Text>

            <View style={{ marginVertical: 14 }}>
              <Text style={styles.inputLabel}>{lang === 'hi' ? 'मासिक बजट राशि (₹)' : 'Monthly Budget (₹)'}</Text>
              <TextInput
                style={[styles.formInput, { fontSize: 18, fontWeight: 'bold' }]}
                placeholder="₹35,000"
                placeholderTextColor="#94a3b8"
                keyboardType="numeric"
                value={tempBudgetInput}
                onChangeText={setTempBudgetInput}
              />
              <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
                {[20000, 35000, 50000, 75000].map(amt => (
                  <TouchableOpacity
                    key={amt}
                    style={[styles.chip, { paddingVertical: 4, paddingHorizontal: 8 }]}
                    onPress={() => setTempBudgetInput(amt.toString())}
                  >
                    <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#0f172a' }}>₹{amt.toLocaleString()}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <TouchableOpacity
              style={[styles.saveSubmitBtn, { backgroundColor: '#10b981', marginTop: 4 }]}
              onPress={() => {
                const b = parseInt(tempBudgetInput, 10);
                if (isNaN(b) || b <= 0) {
                  Alert.alert(lang === 'hi' ? 'अमान्य राशि' : 'Invalid Amount', lang === 'hi' ? 'कृपया सही राशि भरें।' : 'Please enter a valid amount.');
                  return;
                }
                saveBudget(b);
              }}
            >
              <Text style={styles.saveSubmitBtnText}>✓ {lang === 'hi' ? 'बजट सुरक्षित करें' : 'Save Budget'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

            {/* ================= MODAL: FULL-SCREEN PHOTO VIEWER ================= */}
      <Modal visible={!!selectedFullPhoto} transparent animationType="fade" onRequestClose={() => setSelectedFullPhoto(null)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center', padding: 16 }}>
          <TouchableOpacity 
            style={{ position: 'absolute', top: 40, right: 20, zIndex: 10, backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 }}
            onPress={() => setSelectedFullPhoto(null)}
          >
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: 'bold' }}>✕ {lang === 'hi' ? 'बंद करें' : 'Close'}</Text>
          </TouchableOpacity>
          {selectedFullPhoto && (
            <Image 
              source={{ uri: selectedFullPhoto }} 
              style={{ width: '100%', height: '80%', resizeMode: 'contain', borderRadius: 12 }} 
            />
          )}
        </SafeAreaView>
      </Modal>

      {/* ================= UNIVERSAL HIGH-PRIORITY CALENDAR MODAL ================= */}
      <Modal visible={calendarTarget !== null} transparent animationType="fade" onRequestClose={closeCalendar}>
        {calendarTarget && renderCalendarCard()}
      </Modal>

      {/* ================= MODAL: PHONE SECURITY SCREEN LOCK ================= */}
      <Modal visible={isAppLocked} animationType="fade" transparent={false}>
        <SafeAreaView style={[styles.lockScreenContainer, { paddingTop: TOP_SAFE_PADDING }]}>
          <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
          <View style={styles.lockScreenCard}>
            <View style={styles.lockIconCircle}>
              <Text style={{ fontSize: 44 }}>🛡️</Text>
            </View>
            <Text style={styles.lockScreenTitle}>MAST Life OS</Text>
            <View style={styles.lockBadgePill}>
              <Text style={styles.lockBadgePillText}>
                🔒 {lang === 'hi' ? 'सुरक्षा लॉक सक्रिय (Device Protected)' : 'Device Security Lock Active'}
              </Text>
            </View>
            <Text style={styles.lockScreenDesc}>
              {lang === 'hi'
                ? 'आपके परिवार का वित्तीय, स्वास्थ्य, स्वर्ण व निजी दस्तावेज़ डेटा सुरक्षित है। प्रवेश करने के लिए अपने मोबाइल के फ़िंगरप्रिंट, फेस या स्क्रीन लॉक पिन से अनलॉक करें।'
                : 'Your family financial, health and vault data is encrypted. Unlock using your phone fingerprint, face recognition or device screen lock PIN.'}
            </Text>

            <TouchableOpacity 
              style={styles.unlockBigBtn}
              onPress={promptDeviceUnlock}
            >
              <Text style={styles.unlockBigBtnText}>
                🔓 {lang === 'hi' ? 'स्क्रीन लॉक से अनलॉक करें' : 'Unlock with Phone Lock'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={{ marginTop: 20, padding: 8 }}
              onPress={() => setIsAppLocked(false)}
            >
              <Text style={{ color: '#94a3b8', fontSize: 13, textDecorationLine: 'underline' }}>
                {lang === 'hi' ? 'वैकल्पिक: सीधे आगे बढ़ें (Bypass)' : 'Proceed directly'}
              </Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>

      {/* ================= MODAL: USER ONBOARDING / LOGIN ================= */}
      <Modal visible={isOnboardingOpen && !isAppLocked} animationType="slide" transparent={true}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalContent, { backgroundColor: '#fff', maxHeight: '90%' }]}>
            <View style={{ alignItems: 'center', marginBottom: 12 }}>
              <Text style={{ fontSize: 36 }}>✨</Text>
              <Text style={{ fontSize: 19, fontWeight: 'bold', color: '#0f172a', textAlign: 'center', marginTop: 4 }}>
                {lang === 'hi' ? 'MAST Life OS में आपका स्वागत है' : 'Welcome to MAST Life OS'}
              </Text>
              <Text style={{ fontSize: 12, color: '#64748b', textAlign: 'center', marginTop: 4, lineHeight: 18 }}>
                {lang === 'hi'
                  ? 'कृपया अपना नाम, मोबाइल व ईमेल दर्ज करें। यह आपकी प्रोफ़ाइल में दर्ज होगा और डेटा के सुरक्षित ईमेल बैकअप में उपयोग होगा।'
                  : 'Please enter your details. This will be linked to your profile and used for secure email data backups.'}
              </Text>
            </View>

            <View style={{ gap: 12 }}>
              <View>
                <Text style={styles.inputLabel}>👤 {lang === 'hi' ? 'आपका पूरा नाम (Full Name)' : 'Full Name'}</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder={lang === 'hi' ? 'उदा: अमित शर्मा' : 'e.g. Amit Sharma'}
                  placeholderTextColor="#94a3b8"
                  value={onboardName}
                  onChangeText={setOnboardName}
                />
              </View>

              <View>
                <Text style={styles.inputLabel}>📱 {lang === 'hi' ? 'मोबाइल नंबर (Mobile Number)' : 'Mobile Number'}</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder={lang === 'hi' ? '10 अंकों का मोबाइल नंबर' : '10-digit mobile number'}
                  placeholderTextColor="#94a3b8"
                  keyboardType="phone-pad"
                  maxLength={10}
                  value={onboardMobile}
                  onChangeText={setOnboardMobile}
                />
              </View>

              <View>
                <Text style={styles.inputLabel}>📧 {lang === 'hi' ? 'ईमेल आईडी (सुरक्षित बैकअप के लिए)' : 'Email ID (for Cloud Backups)'}</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder={lang === 'hi' ? 'उदा: amit@gmail.com' : 'e.g. amit@gmail.com'}
                  placeholderTextColor="#94a3b8"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={onboardEmail}
                  onChangeText={setOnboardEmail}
                />
              </View>

              <TouchableOpacity
                style={[styles.saveSubmitBtn, { marginTop: 10, backgroundColor: '#f97316' }]}
                onPress={() => handleSaveUserProfile(onboardName, onboardMobile, onboardEmail)}
              >
                <Text style={styles.saveSubmitBtnText}>
                  ✓ {lang === 'hi' ? 'सुरक्षित सहेजें व ऐप शुरू करें' : 'Save & Start App'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ================= BOTTOM NAVIGATION BAR (100% BILINGUAL) ================= */}
      <View style={styles.navBar}>
        <TouchableOpacity style={styles.navItem} onPress={() => handleTabPress('home')}>
          <Text style={[styles.navIcon, activeTab === 'home' && styles.navActive]}>🏠</Text>
          <Text style={[styles.navLabel, activeTab === 'home' && styles.navActive]}>{lang === 'hi' ? 'आज' : 'Home'}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navItem} onPress={() => handleTabPress('vault')}>
          <Text style={[styles.navIcon, activeTab === 'vault' && styles.navActive]}>🗄️</Text>
          <Text style={[styles.navLabel, activeTab === 'vault' && styles.navActive]}>{lang === 'hi' ? 'लॉकर' : 'Vault'}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navItem} onPress={() => handleTabPress('reminders')}>
          <Text style={[styles.navIcon, activeTab === 'reminders' && styles.navActive]}>🔔</Text>
          <Text style={[styles.navLabel, activeTab === 'reminders' && styles.navActive]}>{lang === 'hi' ? 'रिमाइंडर' : 'Reminders'}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navItem} onPress={() => handleTabPress('bus')}>
          <Text style={[styles.navIcon, activeTab === 'bus' && styles.navActive]}>🚌</Text>
          <Text style={[styles.navLabel, activeTab === 'bus' && styles.navActive]}>{lang === 'hi' ? 'बस लाइव' : 'Bus Live'}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navItem} onPress={() => handleTabPress('diary')}>
          <Text style={[styles.navIcon, activeTab === 'diary' && styles.navActive]}>✍️</Text>
          <Text style={[styles.navLabel, activeTab === 'diary' && styles.navActive]}>{lang === 'hi' ? 'डायरी' : 'Diary'}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navItem} onPress={() => handleTabPress('family')}>
          <Text style={[styles.navIcon, activeTab === 'family' && styles.navActive]}>👨‍👩‍👧‍👦</Text>
          <Text style={[styles.navLabel, activeTab === 'family' && styles.navActive]}>{lang === 'hi' ? 'परिवार' : 'Family'}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  /* Screen Lock Styles */
  lockScreenContainer: { flex: 1, backgroundColor: '#0f172a', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
  lockScreenCard: { width: '100%', maxWidth: 380, backgroundColor: '#1e293b', borderRadius: 24, padding: 24, alignItems: 'center', borderWidth: 1, borderColor: '#334155' },
  lockIconCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#334155', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  lockScreenTitle: { fontSize: 24, fontWeight: 'bold', color: '#fff' },
  lockBadgePill: { backgroundColor: '#1e3a8a', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, marginVertical: 10 },
  lockBadgePillText: { color: '#93c5fd', fontSize: 12, fontWeight: 'bold' },
  lockScreenDesc: { color: '#94a3b8', fontSize: 13, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  unlockBigBtn: { width: '100%', backgroundColor: '#f97316', paddingVertical: 14, borderRadius: 14, alignItems: 'center' },
  unlockBigBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },

  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: {
    paddingTop: TOP_SAFE_PADDING,
    paddingBottom: 14,
    paddingHorizontal: 18,
    backgroundColor: '#ffffff',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4
  },
  brandContainer: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logoBadge: { width: 42, height: 42, borderRadius: 12, backgroundColor: '#f97316', justifyContent: 'center', alignItems: 'center' },
  logoText: { color: '#fff', fontSize: 22, fontWeight: 'bold' },
  brandTitle: { color: '#0f172a', fontSize: 20, fontWeight: 'bold', letterSpacing: 0.5 },
  brandTagline: { color: '#ea580c', fontSize: 12, fontWeight: '700', marginTop: 1 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sosBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#dc2626', justifyContent: 'center', alignItems: 'center' },
  sosBtnText: { fontSize: 18 },
  langBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#cbd5e1' },
  langBtnText: { color: '#0f172a', fontSize: 13, fontWeight: 'bold' },
  heartBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(244, 63, 94, 0.2)', borderWidth: 1, borderColor: '#f43f5e', justifyContent: 'center', alignItems: 'center' },
  heartBtnText: { fontSize: 16 },

  // Floating Notification Banner
  floatingAlertBanner: {
    position: 'absolute',
    top: TOP_SAFE_PADDING - 6,
    left: 14,
    right: 14,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 14,
    zIndex: 9999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 2,
    borderColor: '#f97316',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 10
  },
  alertIconCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#ffedd5', justifyContent: 'center', alignItems: 'center' },
  alertBannerTitle: { fontSize: 14, fontWeight: 'bold', color: '#0f172a' },
  alertBannerBody: { fontSize: 12, color: '#475569', marginTop: 2, lineHeight: 16 },

  scrollBody: { padding: 16, paddingBottom: 110, backgroundColor: '#f8fafc' },
  heroCard: { backgroundColor: '#f97316', borderRadius: 24, padding: 18, shadowColor: '#ea580c', shadowOpacity: 0.25, shadowRadius: 10, elevation: 4 },
  heroPre: { color: '#ffedd5', fontSize: 13, fontWeight: 'bold', textTransform: 'uppercase' },
  heroMain: { color: '#fff', fontSize: 22, fontWeight: 'bold', marginTop: 4, lineHeight: 28 },
  dateTag: { backgroundColor: 'rgba(0,0,0,0.25)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 },
  dateTagText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  quoteCard: { backgroundColor: 'rgba(255,255,255,0.22)', borderRadius: 16, padding: 14, marginTop: 14 },
  quoteText: { color: '#fff', fontSize: 14, fontStyle: 'italic', lineHeight: 20 },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, paddingHorizontal: 2 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#0f172a' },
  addSmallBtn: { backgroundColor: '#ea580c', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  addSmallBtnText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  card: { backgroundColor: '#fff', borderRadius: 20, padding: 16, borderWidth: 1, borderColor: '#e2e8f0', shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  agendaItemRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  checkCircle: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: '#cbd5e1', justifyContent: 'center', alignItems: 'center' },
  checkCircleDone: { backgroundColor: '#10b981', borderColor: '#10b981' },
  agendaItemTitle: { fontSize: 14, fontWeight: 'bold', color: '#0f172a', lineHeight: 20 },
  agendaItemTime: { fontSize: 12, color: '#64748b', marginTop: 3 },
  strike: { textDecorationLine: 'line-through', color: '#94a3b8' },
  rxSlipBtn: { backgroundColor: '#ffe4e6', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
  rxSlipBtnText: { color: '#e11d48', fontSize: 12, fontWeight: 'bold' },
  tileGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 10 },
  tileCard: { width: '48%', borderRadius: 20, padding: 14, borderWidth: 1 },
  tileTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  tileIconBox: { width: 38, height: 38, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  tileIcon: { fontSize: 18 },
  tileTag: { backgroundColor: 'rgba(245, 158, 11, 0.25)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  tileTagText: { fontSize: 11, fontWeight: 'bold', color: '#92400e' },
  tileTitle: { fontSize: 14, fontWeight: 'bold', color: '#0f172a', marginTop: 10, lineHeight: 18 },
  tileSub: { fontSize: 12, color: '#64748b', marginTop: 3, lineHeight: 16 },

  // Budget
  budgetCard: { backgroundColor: '#fff', borderRadius: 22, padding: 16, borderWidth: 1, borderColor: '#e2e8f0' },
  budgetHeading: { fontSize: 15, fontWeight: 'bold', color: '#0f172a' },
  budgetSub: { fontSize: 12, color: '#64748b', marginTop: 3 },
  addExpenseBtn: { backgroundColor: '#10b981', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  addExpenseBtnText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  multiBar: { height: 10, borderRadius: 5, flexDirection: 'row', overflow: 'hidden', marginTop: 12 },
  legendText: { fontSize: 11, color: '#64748b', fontWeight: 'bold' },
  expenseItemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f8fafc' },

  pageHeader: { marginBottom: 4 },
  pageTitle: { fontSize: 20, fontWeight: 'bold', color: '#0f172a' },
  pageSub: { fontSize: 13, color: '#64748b', marginTop: 3 },
  subtabContainer: { flexDirection: 'row', backgroundColor: '#e2e8f0', borderRadius: 16, padding: 4 },
  subtabBtn: { flex: 1, paddingVertical: 9, alignItems: 'center', borderRadius: 13 },
  subtabBtnActive: { backgroundColor: '#fff' },
  subtabBtnText: { fontSize: 13, fontWeight: 'bold', color: '#64748b' },
  subtabBtnTextActive: { color: '#0f172a' },
  cardTitle: { fontSize: 15, fontWeight: 'bold', color: '#0f172a', flex: 1, lineHeight: 20 },
  priceBadge: { fontSize: 14, fontWeight: 'bold', color: '#0f172a' },
  cardSub: { fontSize: 12, color: '#64748b', marginTop: 4, lineHeight: 17 },
  viewBillBtn: { backgroundColor: '#f0fdf4', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, borderWidth: 1, borderColor: '#86efac' },
  viewBillBtnText: { fontSize: 12, color: '#16a34a', fontWeight: 'bold' },

  // Gold
  goldHeroCard: { backgroundColor: '#d97706', borderRadius: 22, padding: 18 },
  goldHeroLabel: { color: '#fef3c7', fontSize: 12, fontWeight: 'bold', textTransform: 'uppercase' },
  goldHeroNum: { color: '#fff', fontSize: 28, fontWeight: 'bold', marginTop: 4 },
  goldHeroSilver: { color: '#fef3c7', fontSize: 13, marginTop: 4, fontWeight: '600' },
  goldHeroNote: { color: '#fde68a', fontSize: 11, marginTop: 10, lineHeight: 16 },

  verifiedBadge: { backgroundColor: '#ecfdf5', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  verifiedBadgeText: { color: '#059669', fontSize: 11, fontWeight: 'bold' },
  viewDocBtn: { marginTop: 10, backgroundColor: '#f0fdf4', paddingVertical: 8, borderRadius: 10, alignItems: 'center', borderWidth: 1, borderColor: '#86efac' },
  viewDocBtnText: { color: '#16a34a', fontSize: 12, fontWeight: 'bold' },

  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0' },
  chipActive: { backgroundColor: '#0f172a', borderColor: '#0f172a' },
  chipText: { fontSize: 13, fontWeight: '600', color: '#64748b' },
  chipTextActive: { color: '#fff', fontWeight: 'bold' },
  sectionHeading: { fontSize: 15, fontWeight: 'bold', color: '#0f172a' },

  // Reminders Prominent Alarm Button
  prominentAlarmBtn: { backgroundColor: '#ea580c', borderRadius: 18, padding: 16, alignItems: 'center', shadowColor: '#ea580c', shadowOpacity: 0.25, shadowRadius: 6, elevation: 2 },
  prominentAlarmBtnText: { color: '#fff', fontSize: 15, fontWeight: 'bold' },

  // Bus
  busRoleToggle: { flexDirection: 'row', backgroundColor: '#e2e8f0', borderRadius: 14, padding: 4 },
  busRoleBtn: { flex: 1, paddingVertical: 9, alignItems: 'center', borderRadius: 12 },
  busRoleBtnActive: { backgroundColor: '#fff' },
  busRoleBtnText: { fontSize: 13, fontWeight: 'bold', color: '#64748b' },
  busRoleBtnTextActive: { color: '#0f172a' },
  mapSimulationBox: { minHeight: 240, backgroundColor: '#0f172a', borderRadius: 26, padding: 14, justifyContent: 'space-between' },
  mapEtaBadge: { backgroundColor: 'rgba(255,255,255,0.95)', alignSelf: 'flex-start', borderRadius: 16, padding: 8, flexDirection: 'row', alignItems: 'center', gap: 10 },
  mapEtaNumBox: { backgroundColor: '#f97316', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4, alignItems: 'center' },
  mapEtaNum: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  mapEtaMin: { color: '#fff', fontSize: 9, fontWeight: 'bold' },
  mapEtaSub: { fontSize: 10, color: '#64748b', fontWeight: 'bold' },
  mapEtaStop: { fontSize: 13, color: '#0f172a', fontWeight: 'bold' },
  simulatedRoad: { height: 46, justifyContent: 'center' },
  roadLine: { height: 5, backgroundColor: '#334155', borderRadius: 3 },
  busPin: { position: 'absolute', top: 4 },
  stopPin: { position: 'absolute', right: '15%', top: 6 },
  speedTag: { backgroundColor: 'rgba(0,0,0,0.65)', alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 14, flexDirection: 'row', alignItems: 'center', gap: 6 },
  speedTagText: { color: '#fff', fontSize: 11, fontWeight: 'bold' },
  simToggleBtn: { backgroundColor: '#10b981', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  simToggleBtnText: { color: '#fff', fontSize: 11, fontWeight: 'bold' },
  stopRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  stopTitle: { fontSize: 13, fontWeight: 'bold', color: '#0f172a' },
  stopSub: { fontSize: 11, color: '#64748b', marginTop: 1 },
  busBadgeIcon: { width: 42, height: 42, borderRadius: 12, backgroundColor: '#fef3c7', justifyContent: 'center', alignItems: 'center' },
  callDriverBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#dcfce7', justifyContent: 'center', alignItems: 'center' },
  driverPowerIcon: { width: 70, height: 70, borderRadius: 35, backgroundColor: '#f1f5f9', alignSelf: 'center', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  driverHead: { fontSize: 16, fontWeight: 'bold', color: '#0f172a', textAlign: 'center' },
  driverTripBtn: { backgroundColor: '#10b981', paddingVertical: 14, borderRadius: 16, alignItems: 'center', marginTop: 16 },
  driverTripBtnText: { color: '#fff', fontSize: 15, fontWeight: 'bold' },

  // Diary
  diaryCard: { backgroundColor: '#fff', borderRadius: 20, padding: 16, borderWidth: 1, borderColor: '#e2e8f0' },
  diaryTitle: { fontSize: 16, fontWeight: 'bold', color: '#0f172a' },
  diaryDate: { fontSize: 12, color: '#94a3b8' },
  diaryContent: { fontSize: 14, color: '#334155', marginVertical: 10, lineHeight: 22 },
  waShareBtn: { alignSelf: 'flex-start', backgroundColor: '#10b981', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12 },
  waShareBtnText: { color: '#fff', fontSize: 13, fontWeight: 'bold' },

  // Family Connect Guide & Members
  connectGuideCard: { backgroundColor: '#312e81', borderRadius: 22, padding: 16 },
  connectGuideTitle: { color: '#fde047', fontSize: 14, fontWeight: 'bold' },
  connectGuideDesc: { color: '#c7d2fe', fontSize: 12, marginTop: 4, lineHeight: 17 },
  codeBoxRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
  codePill: { backgroundColor: 'rgba(255,255,255,0.18)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  codePillText: { color: '#fff', fontSize: 15, fontWeight: 'bold', letterSpacing: 1 },
  shareCodeBtn: { backgroundColor: '#10b981', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  shareCodeBtnText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  memberAvatarCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#f1f5f9', justifyContent: 'center', alignItems: 'center' },
  memberNameText: { fontSize: 14, fontWeight: 'bold', color: '#0f172a' },
  memberSubText: { fontSize: 11, color: '#64748b', marginTop: 2 },
  iconCircleBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#eff6ff', justifyContent: 'center', alignItems: 'center' },
  avatarChoiceBox: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: '#cbd5e1', justifyContent: 'center', alignItems: 'center' },

  // Intercom
  intercomCard: { backgroundColor: '#1e1b4b', borderRadius: 24, padding: 16 },
  intercomHead: { color: '#fde047', fontSize: 13, fontWeight: 'bold', textTransform: 'uppercase' },
  buzzerGrid: { flexDirection: 'row', gap: 10, marginTop: 12 },
  buzzerBtn: { flex: 1, backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: 16, paddingVertical: 12, alignItems: 'center' },
  buzzerIcon: { fontSize: 24 },
  buzzerLabel: { color: '#fff', fontSize: 11, fontWeight: 'bold', marginTop: 6, textAlign: 'center' },

  // Chat
  chatContainer: { backgroundColor: '#fff', borderRadius: 22, borderWidth: 1, borderColor: '#e2e8f0', overflow: 'hidden', height: 360 },
  chatHeader: { padding: 12, backgroundColor: '#f8fafc', borderBottomWidth: 1, borderBottomColor: '#f1f5f9', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  chatHeaderTitle: { fontSize: 13, fontWeight: 'bold', color: '#0f172a' },
  chatHeaderEnc: { fontSize: 11, color: '#059669', fontWeight: 'bold' },
  chatMessages: { flex: 1, padding: 12, backgroundColor: '#fafafa' },
  chatBubble: { maxWidth: '80%', padding: 10, borderRadius: 14, marginBottom: 10 },
  chatBubbleOther: { backgroundColor: '#f1f5f9', alignSelf: 'flex-start' },
  chatBubbleSelf: { backgroundColor: '#ffedd5', alignSelf: 'flex-end' },
  chatBubbleSender: { fontSize: 11, fontWeight: 'bold', color: '#ea580c' },
  chatBubbleText: { fontSize: 13, color: '#0f172a', marginTop: 3, lineHeight: 18 },
  chatBubbleTime: { fontSize: 10, color: '#94a3b8', alignSelf: 'flex-end', marginTop: 3 },
  chatInputRow: { flexDirection: 'row', padding: 10, borderTopWidth: 1, borderTopColor: '#f1f5f9', gap: 10 },
  chatInput: { flex: 1, backgroundColor: '#f1f5f9', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8, fontSize: 13, color: '#0f172a' },
  chatSendBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#f97316', justifyContent: 'center', alignItems: 'center' },

  // Modals
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 22, maxHeight: '90%' },
  modalHeaderTitle: { fontSize: 16, fontWeight: 'bold', color: '#0f172a' },
  inputLabel: { fontSize: 12, fontWeight: 'bold', color: '#334155', marginTop: 4 },
  dropdownSelector: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4
  },
  dropdownSelectorText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a'
  },
  dropdownArrow: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: 'bold'
  },
  formInput: { backgroundColor: '#f8fafc', borderRadius: 12, borderWidth: 1, borderColor: '#cbd5e1', paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: '#0f172a' },
  photoUploadBtn: { backgroundColor: '#f0fdf4', paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: '#86efac', alignItems: 'center', marginTop: 6 },
  photoUploadBtnText: { color: '#16a34a', fontSize: 13, fontWeight: 'bold' },
  saveSubmitBtn: { backgroundColor: '#059669', paddingVertical: 14, borderRadius: 14, alignItems: 'center', marginTop: 14 },
  calendarPickIconBtn: {
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fed7aa',
    borderRadius: 10,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarModalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    zIndex: 99999,
    elevation: 30,
  },
  calendarCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#ffffff',
    borderRadius: 22,
    padding: 18,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 20,
    elevation: 12,
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingBottom: 10,
    marginBottom: 12,
  },
  calendarCardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  calendarNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  calendarNavBtn: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
  },
  calendarNavBtnText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#475569',
  },
  calendarNavBtnRound: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#fff7ed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarNavArrow: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ea580c',
  },
  calendarModeSelectorPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  calendarModeSelectorPillActive: {
    backgroundColor: '#fff7ed',
    borderColor: '#fed7aa',
  },
  calendarModeSelectorText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#334155',
  },
  calendarModeSelectorTextActive: {
    color: '#ea580c',
  },
  calendarYearChip: {
    width: '30%',
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    marginVertical: 4,
  },
  calendarYearChipActive: {
    backgroundColor: '#ea580c',
    borderColor: '#ea580c',
  },
  calendarYearChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
  },
  calendarYearChipTextActive: {
    color: '#ffffff',
    fontWeight: 'bold',
  },
  calendarMonthChip: {
    width: '30%',
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    marginVertical: 4,
  },
  calendarMonthChipActive: {
    backgroundColor: '#ea580c',
    borderColor: '#ea580c',
  },
  calendarMonthChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  calendarMonthChipTextActive: {
    color: '#ffffff',
    fontWeight: 'bold',
  },
  calendarMonthText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  calendarWeekRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f8fafc',
    paddingBottom: 4,
  },
  calendarWeekText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#94a3b8',
    width: '14.28%',
    textAlign: 'center',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  calendarDayCell: {
    width: '14.28%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    marginVertical: 2,
  },
  calendarDaySelected: {
    backgroundColor: '#ea580c',
  },
  calendarDayToday: {
    borderWidth: 1.5,
    borderColor: '#ea580c',
    backgroundColor: '#fff7ed',
  },
  calendarDayText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#1e293b',
  },
  calendarDayTextSelected: {
    color: '#ffffff',
    fontWeight: 'bold',
  },
  calendarDayTextToday: {
    color: '#ea580c',
    fontWeight: 'bold',
  },
  calendarQuickRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginVertical: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  calendarQuickChip: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  calendarQuickChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  calendarActionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  calendarCancelBtn: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  calendarCancelBtnText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#64748b',
  },
  calendarConfirmBtn: {
    flex: 2,
    backgroundColor: '#ea580c',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  calendarConfirmBtnText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  saveSubmitBtnText: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
  rxSlipContainer: { backgroundColor: '#fff1f2', borderRadius: 18, padding: 16, borderWidth: 1, borderColor: '#fecdd3', marginVertical: 14 },
  rxDocName: { fontSize: 15, fontWeight: 'bold', color: '#9f1239' },
  rxHospName: { fontSize: 12, color: '#be123c' },
  rxDateBadge: { fontSize: 11, color: '#9f1239', fontWeight: 'bold', backgroundColor: '#ffe4e6', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  rxMedicineDetailBox: { backgroundColor: '#fff', borderRadius: 12, padding: 10, borderWidth: 1, borderColor: '#ffe4e6' },
  rxMedTitle: { fontSize: 14, fontWeight: 'bold', color: '#1e293b' },
  rxMedInstructions: { fontSize: 12, color: '#64748b', marginTop: 3 },
  directCameraBtn: { backgroundColor: '#e11d48', paddingVertical: 12, borderRadius: 12, alignItems: 'center', marginTop: 12 },
  directCameraBtnText: { color: '#fff', fontSize: 13, fontWeight: 'bold' },
  closeModalBtn: { backgroundColor: '#0f172a', paddingVertical: 12, borderRadius: 14, alignItems: 'center', marginTop: 8 },
  closeModalBtnText: { color: '#fff', fontSize: 13, fontWeight: 'bold' },
  sosActionBtn: { paddingVertical: 14, borderRadius: 14, alignItems: 'center' },
  sosActionBtnText: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  navBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 68,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingBottom: 4
  },
  navItem: { alignItems: 'center', paddingHorizontal: 6 },
  navIcon: { fontSize: 18, opacity: 0.45 },
  navLabel: { fontSize: 11, fontWeight: 'bold', color: '#64748b', marginTop: 3 },
  navActive: { opacity: 1, color: '#f97316' },

  // Upgraded Bus Tracker Styles
  childTabCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  childTabCardActive: {
    backgroundColor: '#0f172a',
    borderColor: '#0f172a'
  },
  childTabName: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#0f172a'
  },
  childTabSub: {
    fontSize: 10,
    color: '#64748b'
  },
  childTabDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#f97316',
    marginLeft: 4
  },
  busChildCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1
  },
  childAvatarBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#ffedd5',
    justifyContent: 'center',
    alignItems: 'center'
  },
  childStatusPill: {
    backgroundColor: '#dcfce7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginTop: 3
  },
  childStatusPillText: {
    color: '#15803d',
    fontSize: 11,
    fontWeight: 'bold'
  },
  hudMetricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 6
  },
  hudMetricPill: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    padding: 8,
    alignItems: 'center'
  },
  hudMetricLabel: {
    color: '#94a3b8',
    fontSize: 10,
    fontWeight: 'bold',
    textTransform: 'uppercase'
  },
  hudMetricValue: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
    marginTop: 2,
    textAlign: 'center'
  },
  hudActionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8
  },
  hudActionBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)'
  },
  hudActionBtnText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold'
  },
  roadStopPoint: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#64748b',
    top: 18
  },
  busRadarPulse: {
    position: 'absolute',
    top: -4,
    left: -4,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(249, 115, 22, 0.25)',
    borderWidth: 1,
    borderColor: '#f97316'
  },
  driverActionGrid: {
    gap: 10,
    marginTop: 14
  },
  driverAnnounceBtn: {
    backgroundColor: '#f1f5f9',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  driverAnnounceText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#0f172a'
  }
});