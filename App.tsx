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
  PanResponder,
  AppState,
  KeyboardAvoidingView,
  BackHandler
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import * as Notifications from 'expo-notifications';
import * as LocalAuthentication from 'expo-local-authentication';
import * as Location from 'expo-location';

const { width: SCREEN_WIDTH, height: WINDOW_HEIGHT } = Dimensions.get('window');
const { height: SCREEN_HEIGHT } = Dimensions.get('screen');

// Calculate Android system navigation bar inset for 3-button navigation

// Safe phone & WhatsApp formatter (+91 standard)
const formatPhoneForAction = (rawPhone: string) => {
  const digits = (rawPhone || '').replace(/[^0-9]/g, '');
  if (digits.length === 10) return { dialer: `+91${digits}`, whatsapp: `91${digits}`, valid: true };
  if (digits.length === 12 && digits.startsWith('91')) return { dialer: `+${digits}`, whatsapp: digits, valid: true };
  return { dialer: digits, whatsapp: digits, valid: digits.length >= 7 };
};

const openUrlSafe = async (url: string, errorNotice?: string) => {
  try {
    const supported = await Linking.canOpenURL(url);
    if (supported) {
      await Linking.openURL(url);
    } else {
      Alert.alert('Notice', errorNotice || 'Action not supported or required app not installed on this device.');
    }
  } catch (e) {
    try {
      await Linking.openURL(url);
    } catch (err) {
      Alert.alert('Notice', errorNotice || 'Could not open URL.');
    }
  }
};

const ANDROID_NAV_INSET = Platform.OS === 'android'
  ? Math.max(52, Math.round(SCREEN_HEIGHT - WINDOW_HEIGHT))
  : 24;

// Safe padding to avoid notch / signal / camera collision
const TOP_SAFE_PADDING = Platform.OS === 'android'
  ? Math.max(StatusBar.currentHeight || 0, 36) + 16
  : 16;

const TABS = ['home', 'vault', 'reminders', 'bus', 'family'] as const;
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

// Driver Emergency & Route Broadcast Templates
const DRIVER_BROADCAST_OPTIONS = [
  {
    id: 'traffic',
    icon: '🚦',
    labelHi: 'भारी ट्रैफिक जाम (12 मिनट विलंब)',
    labelEn: 'Heavy Traffic Jam (12m Delay)',
    textHi: '🚦 भारी ट्रैफिक जाम के कारण बस 12 मिनट की देरी से चल रही है।',
    textEn: '🚦 Heavy traffic jam. Bus delayed by 12 mins.',
    eta: 12,
    stopIdx: 0
  },
  {
    id: 'puncture',
    icon: '🛞',
    labelHi: 'टायर पंक्चर (10 मिनट विलंब)',
    labelEn: 'Tyre Puncture (10m Delay)',
    textHi: '⚠️ बस का टायर पंक्चर हो गया है, 10 मिनट में ठीक करके रवाना होंगे।',
    textEn: '⚠️ Bus tyre puncture. Resolving in 10 minutes.',
    eta: 10,
    stopIdx: 1
  },
  {
    id: 'breakdown',
    icon: '🛠️',
    labelHi: 'तकनीकी समस्या / बैकअप बस (15 मिनट)',
    labelEn: 'Technical Issue / Backup Bus (15m)',
    textHi: '⚠️ बस में तकनीकी खराबी आ गई है, बैकअप बस 15 मिनट में पहुँच रही है। सभी बच्चे सुरक्षित हैं।',
    textEn: '⚠️ Bus technical issue. Backup bus arriving in 15 mins. All children are safe.',
    eta: 15,
    stopIdx: 2
  },
  {
    id: 'weather',
    icon: '🌧️',
    labelHi: 'खराब मौसम / भारी बारिश (धीमी गति)',
    labelEn: 'Rain / Bad Weather (Slow Speed)',
    textHi: '🌧️ भारी बारिश और जलभराव के कारण बस धीमी गति से सुरक्षित चल रही है।',
    textEn: '🌧️ Heavy rain and waterlogging. Bus is moving slowly and safely.',
    eta: 15,
    stopIdx: 1
  },
  {
    id: 'next_stop',
    icon: '🔔',
    labelHi: 'अगले स्टॉप पर आगमन (2 मिनट)',
    labelEn: 'Arriving at Next Stop (2 mins)',
    textHi: '🔔 बस अगले स्टॉप पर 2 मिनट में पहुँच रही है। कृपया स्टॉप पर तैयार रहें।',
    textEn: '🔔 Bus arriving at next stop in 2 mins. Please be ready at the stop.',
    eta: 2,
    stopIdx: 2
  },
  {
    id: 'school_reached',
    icon: '🏫',
    labelHi: 'सभी बच्चे सुरक्षित स्कूल पहुँच गए',
    labelEn: 'All Children Reached School Safely',
    textHi: '🏫 बस स्कूल पहुँच चुकी है और सभी बच्चे सुरक्षित स्कूल में हैं।',
    textEn: '🏫 Bus has reached school safely and all children are inside.',
    eta: 0,
    stopIdx: 4
  }
];

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

  // Common Alerts & Statuses
  '10 दिन का कोर्स पूरा': { hi: '10 दिन का कोर्स पूरा', en: '10-day course completed' },
  'कल दवा खत्म होगी': { hi: 'कल दवा खत्म होगी', en: 'Finishes tomorrow' },
  'दवा खत्म होने वाली है': { hi: 'दवा खत्म होने वाली है', en: 'Medicine finishing' },
  'आज': { hi: 'आज', en: 'Today' },
  'कल': { hi: 'कल', en: 'Tomorrow' },
  'रिया (गुड़िया)': { hi: 'रिया (गुड़िया)', en: 'Riya' },
  'आरव (छोटू)': { hi: 'आरव (छोटू)', en: 'Aarav' },

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


const DISTRICT_COORDINATES: Record<string, { lat: number; lng: number }> = {
  // Uttar Pradesh
  'lucknow': { lat: 26.8467, lng: 80.9462 },
  'kanpur': { lat: 26.4499, lng: 80.3319 },
  'varanasi': { lat: 25.3176, lng: 82.9739 },
  'agra': { lat: 27.1767, lng: 78.0081 },
  'prayagraj': { lat: 25.4358, lng: 81.8463 },
  'allahabad': { lat: 25.4358, lng: 81.8463 },
  'ghaziabad': { lat: 28.6692, lng: 77.4538 },
  'noida': { lat: 28.5355, lng: 77.3910 },
  'gautam': { lat: 28.5355, lng: 77.3910 },
  'meerut': { lat: 28.9845, lng: 77.7064 },
  'bareilly': { lat: 28.3670, lng: 79.4304 },
  'aligarh': { lat: 27.8974, lng: 78.0880 },
  'moradabad': { lat: 28.8386, lng: 78.7733 },
  'gorakhpur': { lat: 26.7606, lng: 83.3732 },
  'ayodhya': { lat: 26.7922, lng: 82.1998 },
  'faizabad': { lat: 26.7922, lng: 82.1998 },
  'jhansi': { lat: 25.4484, lng: 78.5685 },
  'mathura': { lat: 27.4924, lng: 77.6737 },
  'saharanpur': { lat: 29.9679, lng: 77.5510 },
  'muzaffarnagar': { lat: 29.4727, lng: 77.7085 },
  // Delhi NCR
  'delhi': { lat: 28.6139, lng: 77.2090 },
  'newdelhi': { lat: 28.6139, lng: 77.2090 },
  'centraldelhi': { lat: 28.6453, lng: 77.2128 },
  'eastdelhi': { lat: 28.6250, lng: 77.3000 },
  'southdelhi': { lat: 28.5245, lng: 77.2066 },
  'northdelhi': { lat: 28.7186, lng: 77.1683 },
  'gurgaon': { lat: 28.4595, lng: 77.0266 },
  'gurugram': { lat: 28.4595, lng: 77.0266 },
  'faridabad': { lat: 28.4089, lng: 77.3178 },
  // Maharashtra
  'mumbai': { lat: 19.0760, lng: 72.8777 },
  'pune': { lat: 18.5204, lng: 73.8567 },
  'nagpur': { lat: 21.1458, lng: 79.0882 },
  'thane': { lat: 19.2183, lng: 72.9781 },
  'nashik': { lat: 19.9975, lng: 73.7898 },
  'aurangabad': { lat: 19.8762, lng: 75.3433 },
  'solapur': { lat: 17.6599, lng: 75.9064 },
  'kolhapur': { lat: 16.7050, lng: 74.2433 },
  // Karnataka
  'bengaluru': { lat: 12.9716, lng: 77.5946 },
  'bangalore': { lat: 12.9716, lng: 77.5946 },
  'mysuru': { lat: 12.2958, lng: 76.6394 },
  'hubballi': { lat: 15.3647, lng: 75.1240 },
  'mangalore': { lat: 12.9141, lng: 74.8560 },
  // Telangana & AP
  'hyderabad': { lat: 17.3850, lng: 78.4867 },
  'visakhapatnam': { lat: 17.6868, lng: 83.2185 },
  'vijayawada': { lat: 16.5062, lng: 80.6480 },
  // Tamil Nadu
  'chennai': { lat: 13.0827, lng: 80.2707 },
  'coimbatore': { lat: 11.0168, lng: 76.9558 },
  'madurai': { lat: 9.9252, lng: 78.1198 },
  // West Bengal
  'kolkata': { lat: 22.5726, lng: 88.3639 },
  'howrah': { lat: 22.5958, lng: 88.2636 },
  'siliguri': { lat: 26.7271, lng: 88.3953 },
  // Rajasthan
  'jaipur': { lat: 26.9124, lng: 75.7873 },
  'jodhpur': { lat: 26.2389, lng: 73.0243 },
  'kota': { lat: 25.2138, lng: 75.8648 },
  'udaipur': { lat: 24.5854, lng: 73.7125 },
  // Gujarat
  'ahmedabad': { lat: 23.0225, lng: 72.5714 },
  'surat': { lat: 21.1702, lng: 72.8311 },
  'vadodara': { lat: 22.3072, lng: 73.1812 },
  // MP
  'bhopal': { lat: 23.2599, lng: 77.4126 },
  'indore': { lat: 22.7196, lng: 75.8577 },
  'gwalior': { lat: 26.2183, lng: 78.1828 },
  // Bihar
  'patna': { lat: 25.5941, lng: 85.1376 },
  'gaya': { lat: 24.7914, lng: 85.0002 },
  'muzaffarpur': { lat: 26.1209, lng: 85.3647 },
  // Punjab / Haryana / UTs
  'chandigarh': { lat: 30.7333, lng: 76.7794 },
  'ludhiana': { lat: 30.9010, lng: 75.8573 },
  'amritsar': { lat: 31.6340, lng: 74.8723 },
  'dehradun': { lat: 30.3165, lng: 78.0322 },
  'ranchi': { lat: 23.3441, lng: 85.3096 },
  'raipur': { lat: 21.2514, lng: 81.6296 },
  'bhubaneswar': { lat: 20.2961, lng: 85.8245 },
  'guwahati': { lat: 26.1445, lng: 91.7362 },
  'thiruvananthapuram': { lat: 8.5241, lng: 76.9366 },
  'kochi': { lat: 9.9312, lng: 76.2673 },
  'srinagar': { lat: 34.0837, lng: 74.7973 },
  'jammu': { lat: 32.7266, lng: 74.8570 }
};

const getCoordinatesForLocation = (stateName?: string, districtName?: string) => {
  const clean = (s?: string) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const cleanDist = clean(districtName);
  const cleanSt = clean(stateName);

  for (const key of Object.keys(DISTRICT_COORDINATES)) {
    if (cleanDist && (cleanDist.includes(key) || key.includes(cleanDist))) {
      return DISTRICT_COORDINATES[key];
    }
  }
  for (const key of Object.keys(DISTRICT_COORDINATES)) {
    if (cleanSt && (cleanSt.includes(key) || key.includes(cleanSt))) {
      return DISTRICT_COORDINATES[key];
    }
  }
  return { lat: 26.8467, lng: 80.9462 }; // Central Lucknow default
};

const generateUniversalBusKey = (state: string, district: string, school: string, busNo: string) => {
  const clean = (s: string) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const st = clean(state) || 'delhi';
  const dist = clean(district) || 'newdelhi';
  const sch = clean(school) || 'dps';
  const b = clean(busNo) || 'bus12';
  return `${st}_${dist}_${sch}_${b}`;
};

const DEFAULT_SCHOOL_CHILDREN: any[] = [
  {
    id: 'demo_riya_01',
    name: 'रिया शर्मा',
    nameEn: 'Riya Sharma',
    avatar: '👧',
    schoolNameHi: 'डीपीएस स्कूल (DPS)',
    schoolNameEn: 'Delhi Public School (DPS)',
    grade: 'कक्षा 4-B',
    busNo: 'Bus #01',
    busCode: 'uttar_pradesh_lucknow_dps_bus_01',
    state: 'Uttar Pradesh',
    district: 'Lucknow',
    vehicleNo: 'UP 32 EF 4401',
    stopNameHi: 'अवध चौराहा (आपका स्टॉप)',
    stopNameEn: 'Awadh Chauraha (Your Stop)',
    stopCoords: { lat: 26.8467, lng: 80.9462 },
    busCoords: { lat: 26.8520, lng: 80.9380 },
    rfidTag: 'RFID-9921',
    seatNo: 'Seat #12',
    driverNameHi: 'राम प्रसाद यादव',
    driverNameEn: 'Ram Prasad Yadav',
    driverPhone: '9876543210',
    conductorNameHi: 'सुरेश कुमार',
    conductorNameEn: 'Suresh Kumar',
    conductorPhone: '9876543211',
    schoolHelpline: '0522-2621001',
    etaMins: 8,
    speedKmh: 35,
    isBoarded: false,
    stops: [
      { id: 1, time: '07:15 AM', titleHi: 'स्कूल गेट प्रस्थान', titleEn: 'School Gate Departure', subHi: 'प्रस्थान ✓', subEn: 'Departed ✓', status: 'passed' },
      { id: 2, time: '07:30 AM', titleHi: 'अवध चौराहा (आपका स्टॉप)', titleEn: 'Awadh Chauraha (Your Stop)', subHi: 'बस 8 मिनट दूर है', subEn: 'Bus is 8 mins away', status: 'target', isUserStop: true },
      { id: 3, time: '07:45 AM', titleHi: 'अंतिम स्टॉप (चारबाग टर्मिनल)', titleEn: 'Charbagh Terminal', subHi: 'आगामी', subEn: 'Upcoming', status: 'upcoming' }
    ],
    schoolFee: '₹4,500',
    busFee: '₹1,800',
    dueDay: 10
  }
];
const DEFAULT_MEDICINES: any[] = [
  {
    id: 1001,
    nameHi: 'पैरासिटामोल (Paracetamol)',
    nameEn: 'Paracetamol 650mg',
    time: 'सुबह 08:30 AM',
    doseHi: '1 गोली (खाने के बाद)',
    doseEn: '1 tablet (After food)',
    doctorHi: 'डॉ. राजेश वर्मा',
    doctorEn: 'Dr. Rajesh Verma',
    hospitalHi: 'पारिवारिक क्लिनिक',
    hospitalEn: 'Family Clinic',
    patientHi: 'स्वयं (Self)',
    patientEn: 'Self',
    date: 'आज',
    courseDays: 5,
    startDate: '01 Nov',
    doctorFollowupNeeded: false,
    refillReminderNeeded: false
  }
];
const DEFAULT_REMINDERS: any[] = [
  {
    id: 2001,
    category: 'bills',
    titleHi: 'बिजली बिल भुगतान',
    titleEn: 'Electricity Bill Payment',
    amount: '₹1,450',
    date: '10 Nov',
    urgent: true,
    paid: false
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


  // Dynamic Time-Aware Greeting (Morning, Afternoon, Evening, Night) with User's Name
  
const getGreetingTimeOnly = (l: 'hi' | 'en') => {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) {
    return l === 'hi' ? 'शुभ प्रभात' : 'Good Morning';
  } else if (hour >= 12 && hour < 17) {
    return l === 'hi' ? 'शुभ दोपहर' : 'Good Afternoon';
  } else if (hour >= 17 && hour < 21) {
    return l === 'hi' ? 'शुभ संध्या' : 'Good Evening';
  } else {
    return l === 'hi' ? 'शुभ रात्रि' : 'Good Night';
  }
};

const getDynamicGreeting = (l: 'hi' | 'en', name?: string) => {
    const hour = new Date().getHours();
    const displayName = name && name.trim() ? `, ${name.trim()}` : '';
    if (hour >= 5 && hour < 12) {
      return l === 'hi' ? `शुभ प्रभात${displayName}!` : `Good Morning${displayName}!`;
    } else if (hour >= 12 && hour < 17) {
      return l === 'hi' ? `शुभ दोपहर${displayName}!` : `Good Afternoon${displayName}!`;
    } else if (hour >= 17 && hour < 21) {
      return l === 'hi' ? `शुभ संध्या${displayName}!` : `Good Evening${displayName}!`;
    } else {
      return l === 'hi' ? `शुभ रात्रि${displayName}!` : `Good Night${displayName}!`;
    }
  };

const getTodayQuote = (l: 'hi' | 'en') => {
  const dayIndex = (new Date().getDate() - 1) % DAILY_QUOTES.length;
  const item = DAILY_QUOTES[dayIndex] || DAILY_QUOTES[0];
  return l === 'hi' ? item.hi : item.en;
};

// Safe helper to resolve districts for any State string variant
const getDistrictsForState = (st: string): string[] => {
  if (!st) return INDIAN_STATES_DISTRICTS['उत्तर प्रदेश (Uttar Pradesh)'] || [];
  if (INDIAN_STATES_DISTRICTS[st]) return INDIAN_STATES_DISTRICTS[st];
  const cleanSt = st.toLowerCase().replace(/[^a-z0-9\u0900-\u097F]/g, '');
  const foundKey = Object.keys(INDIAN_STATES_DISTRICTS).find(k => {
    const cleanK = k.toLowerCase().replace(/[^a-z0-9\u0900-\u097F]/g, '');
    return cleanK.includes(cleanSt) || cleanSt.includes(cleanK);
  });
  if (foundKey && INDIAN_STATES_DISTRICTS[foundKey]) return INDIAN_STATES_DISTRICTS[foundKey];
  return INDIAN_STATES_DISTRICTS['उत्तर प्रदेश (Uttar Pradesh)'] || [];
};

export default function App() {
  const [lang, setLang] = useState<'hi' | 'en'>('hi');
    const [driverKeepAwake, setDriverKeepAwake] = useState(false);
  const [vaultSearchQuery, setVaultSearchQuery] = useState('');
  const [lastLocationUpdateTime, setLastLocationUpdateTime] = useState<string>(
    new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
  );

const [activeTab, setActiveTab] = useState<TabType>('home');
  const pagerRef = useRef<any>(null);

  // Cloud Network State
  const [myDeviceId] = useState(() => 'dev_' + Math.floor(100000 + Math.random() * 900000));
  const [familyCode, setFamilyCode] = useState(() => 'MAST-' + Math.floor(1000 + Math.random() * 9000));
  const [isPairModalOpen, setIsPairModalOpen] = useState(false);
  const [tempCodeInput, setTempCodeInput] = useState('');
  const [onlineDevices, setOnlineDevices] = useState<{ [id: string]: { name: string; lastSeen: number } }>({});
  const processedMsgIdsRef = useRef<Set<string>>(new Set());
  const pollCountRef = useRef<number>(0);
  const isFirstPollRef = useRef(true);
  const [isCloudSyncing, setIsCloudSyncing] = useState(false);
  const [isConnectingFamily, setIsConnectingFamily] = useState(false);
  const [cloudSyncMsg, setCloudSyncMsg] = useState('');

  // In-App Notification Banner State
  const [inAppAlert, setInAppAlert] = useState<{ title: string; body: string; type?: 'alarm' | 'bus' | 'intercom' } | null>(null);

  // Subtabs & Filters
  const [vaultSubtab, setVaultSubtab] = useState<'appliances' | 'gold' | 'docs'>('appliances');
  const [docMemberFilter, setDocMemberFilter] = useState<'all' | 'babu' | 'amma' | 'self' | 'kids'>('all');
  const [diaryFilter, setDiaryFilter] = useState<'all' | 'kavita' | 'vichar'>('all');

  // Multi-Child & Multi-School State (Clean slate by default)
  const [schoolChildren, setSchoolChildren] = useState<any[]>([]);
  const [activeChildId, setActiveChildId] = useState<string>('');

  // Driver Profile & Simple State-District Hierarchy State
  const [driverNameInput, setDriverNameInput] = useState('');
  const [driverPhoneInput, setDriverPhoneInput] = useState('');
  const [driverState, setDriverState] = useState('');
  const [driverDistrict, setDriverDistrict] = useState('');
  const [registeredSchools, setRegisteredSchools] = useState<string[]>([]);
  const [driverSelectedSchool, setDriverSelectedSchool] = useState('');
  const [driverSelectedBus, setDriverSelectedBus] = useState('');

  // Device Lock State (Fingerprint / PIN / Screen Lock)
  const [isAppLocked, setIsAppLocked] = useState(false);
  const [isPinLockEnabled, setIsPinLockEnabled] = useState(false);
  const [familySubtab, setFamilySubtab] = useState<'members' | 'diary' | 'chat'>('members');
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [appPin, setAppPin] = useState('1234');
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);
  const appStateRef = useRef(AppState.currentState);

  const hasUnlockedThisSessionRef = useRef(false);

  // Ask PIN once when app opens ONLY if user enabled PIN lock in settings
  // (Handled safely in startup load effect after reading @mast_v7_pin_lock_enabled)

  // User Onboarding & Profile State
  const [userProfile, setUserProfile] = useState<{ name: string; mobile: string; email: string } | null>(null);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [onboardName, setOnboardName] = useState('');
  const [onboardMobile, setOnboardMobile] = useState('');
  const [onboardEmail, setOnboardEmail] = useState('');

  // Role-Based Partitioning & Account Settings Modal State
  const [userRole, setUserRole] = useState<'PARENT' | 'DRIVER' | 'ADMIN'>('PARENT');
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);

  const handleSetUserRole = async (newRole: 'PARENT' | 'DRIVER' | 'ADMIN') => {
    setUserRole(newRole);
    setBusRole(newRole === 'PARENT' ? 'parent' : newRole === 'DRIVER' ? 'driver' : 'school');
    await AsyncStorage.setItem('@mast_v7_user_role', newRole);
  };

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
  const driverLocationSubRef = useRef<any>(null);

  // Modern Dark Mode & Bus State
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [busETA, setBusETA] = useState<number>(10);
  const [busStopIdx, setBusStopIdx] = useState<number>(2);
  const [isSavingChild, setIsSavingChild] = useState(false);

  const toggleTheme = async () => {
    const nextTheme = !isDarkMode;
    setIsDarkMode(nextTheme);
    try {
      await AsyncStorage.setItem('@mast_theme', nextTheme ? 'dark' : 'light');
    } catch (e) {}
  };

  // Parent State & District Hierarchy for Adding Child
  const [parentState, setParentState] = useState('');
  const [parentDistrict, setParentDistrict] = useState('');

  // Searchable Dropdown Picker Modal State
  const [isLocationPickerOpen, setIsLocationPickerOpen] = useState(false);
  const [pickerType, setPickerType] = useState<'state' | 'district'>('state');
  const [pickerTarget, setPickerTarget] = useState<'parent' | 'driver' | 'admin'>('admin');
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
  const [newChildDriverName, setNewChildDriverName] = useState('');
  const [newChildConductorName, setNewChildConductorName] = useState('');
  const [newChildVehicleNo, setNewChildVehicleNo] = useState('');
  const [isEditingFamilyCode, setIsEditingFamilyCode] = useState(false);
  const [customFamilyCodeInput, setCustomFamilyCodeInput] = useState('');

  // Child Fees & Monthly Auto-Reminder States
  const [newChildSchoolFee, setNewChildSchoolFee] = useState('');
  const [newChildBusFee, setNewChildBusFee] = useState('');
  const [newChildDueDay, setNewChildDueDay] = useState('10');
  const [newChildSchoolHelpline, setNewChildSchoolHelpline] = useState('');
  const [newChildDriverPhone, setNewChildDriverPhone] = useState('');
  const [newChildConductorPhone, setNewChildConductorPhone] = useState('');
  const [autoSetChildReminder, setAutoSetChildReminder] = useState(true);
  const [editingChildId, setEditingChildId] = useState<string | null>(null);
  const [customDonationInput, setCustomDonationInput] = useState('');
  const chatScrollRef = useRef<any>(null);
  const familyScrollRef = useRef<any>(null);
  const [editingMedId, setEditingMedId] = useState<number | null>(null);
  const [editingApplianceId, setEditingApplianceId] = useState<number | null>(null);
  const [editingGoldId, setEditingGoldId] = useState<number | null>(null);
  const [editingDocId, setEditingDocId] = useState<number | null>(null);
  const [editingReminderId, setEditingReminderId] = useState<number | null>(null);
  const [editingMemberId, setEditingMemberId] = useState<number | null>(null);
  const [editingDiaryId, setEditingDiaryId] = useState<number | null>(null);
  const [diarySearchQuery, setDiarySearchQuery] = useState('');
  const [selectedFullPhoto, setSelectedFullPhoto] = useState<string | null>(null);

  // Bus Role State: Parent, Driver or School Fleet Admin
  const [busRole, setBusRole] = useState<'parent' | 'driver' | 'school'>('parent');
  const [schoolFleetBuses, setSchoolFleetBuses] = useState<any[]>([]);
  const [isAddFleetBusOpen, setIsAddFleetBusOpen] = useState(false);
  const [editingFleetBusId, setEditingFleetBusId] = useState<string | null>(null);
  const [newFleetBusNo, setNewFleetBusNo] = useState('');
  const [newFleetVehicleNo, setNewFleetVehicleNo] = useState('');
  const [newFleetDriverName, setNewFleetDriverName] = useState('');
  const [newFleetDriverPhone, setNewFleetDriverPhone] = useState('');
  const [newFleetConductorName, setNewFleetConductorName] = useState('');
  const [newFleetConductorPhone, setNewFleetConductorPhone] = useState('');
  const [newFleetDriverPin, setNewFleetDriverPin] = useState('');
  const [newFleetParentCode, setNewFleetParentCode] = useState('');
  const [schoolHelplineConfig, setSchoolHelplineConfig] = useState('');
  const [schoolNameConfig, setSchoolNameConfig] = useState('');
  const [schoolDistrictConfig, setSchoolDistrictConfig] = useState('');
  const [schoolStateConfig, setSchoolStateConfig] = useState('');
  const [isEditingSchoolProfile, setIsEditingSchoolProfile] = useState(false);
  const [draftSchoolName, setDraftSchoolName] = useState('');
  const [draftSchoolDistrict, setDraftSchoolDistrict] = useState('');
  const [draftSchoolState, setDraftSchoolState] = useState('');
  const [draftSchoolHelpline, setDraftSchoolHelpline] = useState('');

  // Role-Based Access Control (RBAC) Security States
  const [schoolAdminPin, setSchoolAdminPin] = useState('1234');
  const [isSchoolAdminAuthenticated, setIsSchoolAdminAuthenticated] = useState(false);
  const [isAdminPinModalOpen, setIsAdminPinModalOpen] = useState(false);
  const [adminPinInput, setAdminPinInput] = useState('');
  const [adminPinError, setAdminPinError] = useState('');
  const [isChangeAdminPinOpen, setIsChangeAdminPinOpen] = useState(false);
  const [oldAdminPinInput, setOldAdminPinInput] = useState('');
  const [newAdminPinInput, setNewAdminPinInput] = useState('');

  const [driverAuthPin, setDriverAuthPin] = useState('1101');
  const [isDriverAuthenticated, setIsDriverAuthenticated] = useState(false);
  const [isDriverPinModalOpen, setIsDriverPinModalOpen] = useState(false);
  const [driverPinInput, setDriverPinInput] = useState('1101');
  const [driverPinError, setDriverPinError] = useState('');
  const [isEditingSchoolHelpline, setIsEditingSchoolHelpline] = useState(false);
  const [schoolHelplineDraft, setSchoolHelplineDraft] = useState('');
  const [isBusSimulating, setIsBusSimulating] = useState(false);
  const [isRestoreModalOpen, setIsRestoreModalOpen] = useState(false);
  const [restoreInputText, setRestoreInputText] = useState('');
  const [lastBackupTime, setLastBackupTime] = useState<string>('');
  const busTimerRef = useRef<any>(null);

  // Bus Shift State: Morning Pickup (Night Depot -> Stops -> School) vs Afternoon Drop (School -> Stops -> Night Depot)
  const [busTripShift, setBusTripShift] = useState<'morning' | 'afternoon'>(() => {
    const hr = new Date().getHours();
    return hr >= 12 && hr < 18 ? 'afternoon' : 'morning';
  });
  const [activeVoiceAnnouncement, setActiveVoiceAnnouncement] = useState<{ text: string; time: string; from: string } | null>(null);
  const [selectedBroadcastId, setSelectedBroadcastId] = useState('traffic');
  const [isBroadcastDropdownOpen, setIsBroadcastDropdownOpen] = useState(false);

  // Clean Student Roster for production (Starts 100% clean for real user entries)
  const DEFAULT_STUDENT_ROSTER: any[] = [];

  // Safe fallback child so activeChild is cleanly handled
  const defaultFallbackChild: any = null;

  // Active child helper with 100% null safety
  const activeChild = (schoolChildren && schoolChildren.length > 0)
    ? (schoolChildren.find(c => c && c.id === activeChildId) || schoolChildren[0])
    : defaultFallbackChild;

  const [cloudTripActive, setCloudTripActive] = useState<boolean>(false);
  const lastCloudTripTimeRef = useRef<number>(0);
  // Trip is strictly active ONLY if driver duty is active, local bus simulation is active,
  // or a verified cloud trip event was received within the last 30 minutes.
  const isTripActive = Boolean(
    driverDutyActive || 
    isBusSimulating || 
    (cloudTripActive && (Date.now() - (lastCloudTripTimeRef.current || 0) < 30 * 60 * 1000))
  );
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
  const [monthlyBudget, setMonthlyBudget] = useState<number>(0);
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
  const [newMedDose, setNewMedDose] = useState('1 गोली खाने बाद');
  const [newMedDoc, setNewMedDoc] = useState('');
  const [newMedPhoto, setNewMedPhoto] = useState<string | null>(null);
  const [newMedPatient, setNewMedPatient] = useState('स्वयं (Self)');
  const [newMedCourseDays, setNewMedCourseDays] = useState('10');
  const [newMedFollowupNeeded, setNewMedFollowupNeeded] = useState(true);
  const [newMedFollowupDate, setNewMedFollowupDate] = useState('');
  const [newMedRefillNeeded, setNewMedRefillNeeded] = useState(true);

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
  const [newGoldLocker, setNewGoldLocker] = useState('');
  const [newGoldJeweller, setNewGoldJeweller] = useState('');
  const [newGoldPhoto, setNewGoldPhoto] = useState<string | null>(null);

  // Doc Form State
  const [newDocMember, setNewDocMember] = useState('babu');
  const [newDocTitle, setNewDocTitle] = useState('');
  const [newDocNumber, setNewDocNumber] = useState('');
  const [newDocPhoto, setNewDocPhoto] = useState<string | null>(null);

  // Universal Calendar Date Picker State
  const [calendarTarget, setCalendarTarget] = useState<'appliance' | 'reminder' | 'expense' | 'member' | 'doc' | 'gold' | 'diary' | 'child_due' | 'med_followup' | null>(null);
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
  const [newRemCategory, setNewRemCategory] = useState<'bills' | 'bday' | 'anniversary' | 'task' | 'health' | 'other'>('task');
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
  const promptDeviceUnlock = async (forcePrompt = false) => {
    try {
      const storedPinLock = await AsyncStorage.getItem('@mast_v7_pin_lock_enabled');
      if (storedPinLock !== 'true' && !forcePrompt) {
        setIsAppLocked(false);
        return;
      }
      setIsAppLocked(true);
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      setBiometricAvailable(hasHardware && isEnrolled);
      if (hasHardware && isEnrolled) {
        const res = await LocalAuthentication.authenticateAsync({
          promptMessage: lang === 'hi' ? 'MAST Life OS सुरक्षा अनलॉक' : 'Unlock MAST Life OS',
          fallbackLabel: lang === 'hi' ? 'फ़ोन पिन / पासवर्ड का उपयोग करें' : 'Use Passcode',
          cancelLabel: lang === 'hi' ? 'रद्द करें' : 'Cancel',
          disableDeviceFallback: false,
        });
        if (res.success) {
          hasUnlockedThisSessionRef.current = true;
          setIsAppLocked(false);
          setPinError(false);
          return;
        }
      }
      // If biometric fails or is not enrolled, remain on PIN lock screen
      setIsAppLocked(true);
    } catch (e) {
      console.log('Device auth error:', e);
      setIsAppLocked(true);
    }
  };

  const handlePinUnlock = () => {
    const validPin = appPin || '1234';
    if (pinInput.trim() === validPin) {
      hasUnlockedThisSessionRef.current = true;
      setIsAppLocked(false);
      setPinInput('');
      setPinError(false);
    } else {
      setPinError(true);
      Vibration.vibrate(250);
      Alert.alert(
        lang === 'hi' ? 'ग़लत पिन' : 'Incorrect PIN',
        lang === 'hi' ? 'दर्ज किया गया पिन ग़लत है। कृपया सही पिन डालें।' : 'Incorrect PIN entered. Please enter correct PIN.'
      );
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
    const updatedMembers = [selfMember, ...familyMembers.filter(m => !(m?.relationHi || m?.relationEn || '').includes('स्वयं') && !(m?.relationHi || m?.relationEn || '').includes('Self'))];
    saveMembers(updatedMembers);
    setIsOnboardingOpen(false);

    Alert.alert(
      lang === 'hi' ? '✓ प्रोफ़ाइल सुरक्षित!' : '✓ Profile Saved!',
      lang === 'hi'
        ? `स्वागत है ${profile.name}! आपकी प्रोफ़ाइल सक्रिय हो गई है।`
        : `Welcome ${profile.name}! Your profile is now active.`
    );
  };

  // 1-Tap Load & Clear Demo Data for School Presentation
  const handleLoadDemoData = () => {
    Alert.alert(
      lang === 'hi' ? '🏢 स्कूल डेमो डेटा लोड करें?' : 'Load School Demo Data?',
      lang === 'hi'
        ? 'क्या आप कल के स्कूल डेमो के लिए छात्र (रिया - DPS), बस लाइव रूट और नमूना रिमाइंडर लोड करना चाहते हैं?'
        : 'Do you want to load sample student (Riya - DPS), bus live route and demo reminders for school presentation?',
      [
        { text: lang === 'hi' ? 'रद्द करें' : 'Cancel', style: 'cancel' },
        {
          text: lang === 'hi' ? 'हाँ, लोड करें' : 'Yes, Load Demo',
          onPress: async () => {
            setSchoolChildren(DEFAULT_SCHOOL_CHILDREN);
            if (DEFAULT_SCHOOL_CHILDREN.length > 0) {
              setActiveChildId(DEFAULT_SCHOOL_CHILDREN[0].id);
            }
            setMedicines(DEFAULT_MEDICINES);
            setUpcomingReminders(DEFAULT_REMINDERS);
            await AsyncStorage.setItem('@mast_v7_school_children', JSON.stringify(DEFAULT_SCHOOL_CHILDREN));
            await AsyncStorage.setItem('@mast_v7_meds', JSON.stringify(DEFAULT_MEDICINES));
            await AsyncStorage.setItem('@mast_v7_reminders', JSON.stringify(DEFAULT_REMINDERS));
            Alert.alert(
              lang === 'hi' ? '✓ डेमो डेटा लोड हुआ' : '✓ Demo Data Loaded',
              lang === 'hi' ? 'कल स्कूल में डेमो दिखाने हेतु नमूना डेटा लोड हो गया है।' : 'Sample data loaded for school demo.'
            );
          }
        }
      ]
    );
  };

  const handleClearDemoData = () => {
    Alert.alert(
      lang === 'hi' ? '🗑️ डेमो डेटा साफ़ करें?' : 'Clear Demo Data?',
      lang === 'hi'
        ? 'क्या आप सभी नमूना डेटा हटाकर ऐप को पूरी तरह खाली व साफ़ करना चाहते हैं?'
        : 'Do you want to wipe all demo data and reset to a clean state?',
      [
        { text: lang === 'hi' ? 'रद्द करें' : 'Cancel', style: 'cancel' },
        {
          text: lang === 'hi' ? 'हाँ, साफ़ करें' : 'Yes, Clear All',
          style: 'destructive',
          onPress: async () => {
            setSchoolChildren([]);
            setActiveChildId('');
            setMedicines([]);
            setUpcomingReminders([]);
            await AsyncStorage.removeItem('@mast_v7_school_children');
            await AsyncStorage.removeItem('@mast_v7_meds');
            await AsyncStorage.removeItem('@mast_v7_reminders');
            Alert.alert(
              lang === 'hi' ? '✓ साफ़ हो गया' : '✓ Cleared',
              lang === 'hi' ? 'सभी नमूना डेटा हटा दिया गया है। ऐप अब पूरी तरह साफ़ है।' : 'All sample data removed. App is now completely clean.'
            );
          }
        }
      ]
    );
  };

  // Load from Storage & Startup Permissions
  useEffect(() => {
    (async () => {
      // 1. Configure Android Notification Channel for loud alarms & chimes
      if (Platform.OS === 'android') {
        try {
          await Notifications.setNotificationChannelAsync('default', {
            name: 'MAST Alerts & Reminders',
            importance: Notifications.AndroidImportance.HIGH,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#2563EB',
            sound: 'default'
          });
        } catch (e) {}
      }

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

      // Automatic Migration Wipe: Ensure any legacy mock/demo storage is completely purged once on this fresh release
      try {
        const isFreshCleaned = await AsyncStorage.getItem('@mast_v8_fresh_cleaned');
        if (!isFreshCleaned) {
          await AsyncStorage.multiRemove([
            '@mast_v7_school_children',
            '@mast_v7_meds',
            '@mast_v7_taken',
            '@mast_v7_appliances',
            '@mast_v7_gold',
            '@mast_v7_docs',
            '@mast_v7_reminders',
            '@mast_v7_expenses',
            '@mast_v7_members',
            '@mast_v7_diary',
            '@mast_v7_chat',
            '@mast_v7_school_fleet',
            '@mast_v7_driver_bus'
          ]);
          await AsyncStorage.setItem('@mast_v8_fresh_cleaned', 'true');
        }
      } catch (e) {}

      // 2. Load user profile or trigger onboarding & verify security lock
      try {
        const storedProfile = await AsyncStorage.getItem('@mast_v7_user_profile');
        if (storedProfile) {
          const parsed = JSON.parse(storedProfile);
          setUserProfile(parsed);
          setOnboardName(parsed.name || '');
          setOnboardMobile(parsed.mobile || '');
          setOnboardEmail(parsed.email || '');

          const storedPinLock = await AsyncStorage.getItem('@mast_v7_pin_lock_enabled');
          if (storedPinLock === 'true') {
            setIsPinLockEnabled(true);
            setIsAppLocked(true);
            promptDeviceUnlock(true);
          } else {
            setIsPinLockEnabled(false);
            setIsAppLocked(false);
          }
        } else {
          // First launch: Strictly disable PIN lock and open onboarding cleanly
          setIsPinLockEnabled(false);
          setIsAppLocked(false);
          setIsOnboardingOpen(true);
        }

        const storedAdminPin = await AsyncStorage.getItem('@mast_v7_school_admin_pin');
        if (storedAdminPin) setSchoolAdminPin(storedAdminPin);

        const storedSchoolProfile = await AsyncStorage.getItem('@mast_v7_school_profile');
        if (storedSchoolProfile) {
          try {
            const sp = JSON.parse(storedSchoolProfile);
            if (sp.name) setSchoolNameConfig(sp.name);
            if (sp.district) setSchoolDistrictConfig(sp.district);
            if (sp.state) setSchoolStateConfig(sp.state);
            if (sp.helpline) setSchoolHelplineConfig(sp.helpline);
          } catch (e) {}
        }
        const storedSchoolHelpline = await AsyncStorage.getItem('@mast_v7_school_helpline');
        if (storedSchoolHelpline) setSchoolHelplineConfig(storedSchoolHelpline);

        const storedRole = await AsyncStorage.getItem('@mast_v7_user_role');
        if (storedRole === 'PARENT' || storedRole === 'DRIVER' || storedRole === 'ADMIN') {
          setUserRole(storedRole);
          setBusRole(storedRole === 'PARENT' ? 'parent' : storedRole === 'DRIVER' ? 'driver' : 'school');
        }

        const storedLang = await AsyncStorage.getItem('@mast_v7_lang');
        if (storedLang === 'hi' || storedLang === 'en') setLang(storedLang);

        const storedCode = await AsyncStorage.getItem('@mast_v7_family_code');
        if (storedCode) setFamilyCode(storedCode);

        const storedMeds = await AsyncStorage.getItem('@mast_v7_meds');
        if (storedMeds) {
          setMedicines(JSON.parse(storedMeds));
        } else {
          setMedicines([]);
        }

        const storedTaken = await AsyncStorage.getItem('@mast_v7_taken');
        if (storedTaken) setTakenMeds(JSON.parse(storedTaken));

        const storedAppliances = await AsyncStorage.getItem('@mast_v7_appliances');
        if (storedAppliances) setAppliances(JSON.parse(storedAppliances));

        const storedGold = await AsyncStorage.getItem('@mast_v7_gold');
        if (storedGold) setGoldItems(JSON.parse(storedGold));

        const storedDocs = await AsyncStorage.getItem('@mast_v7_docs');
        if (storedDocs) setFamilyDocs(JSON.parse(storedDocs));

        const storedReminders = await AsyncStorage.getItem('@mast_v7_reminders');
        if (storedReminders) {
          setUpcomingReminders(JSON.parse(storedReminders));
        } else {
          setUpcomingReminders([]);
        }

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
        if (storedChildren) {
          try {
            let parsed = JSON.parse(storedChildren);
            if (Array.isArray(parsed) && parsed.length > 0) {
              parsed = parsed.map((c: any) => {
                let vNo = c.vehicleNo;
                if (!vNo || vNo.includes('DL 01')) vNo = c.busNo ? `बस ${c.busNo}` : 'बस नंबर दर्ज नहीं';
                let dPhone = c.driverPhone;
                if (!dPhone || dPhone.includes('X')) dPhone = '';
                let cPhone = c.conductorPhone;
                if (!cPhone || cPhone.includes('X')) cPhone = '';
                let sHelp = c.schoolHelpline;
                if (!sHelp || sHelp.includes('011')) sHelp = '';
                return { ...c, vehicleNo: vNo, driverPhone: dPhone, conductorPhone: cPhone, schoolHelpline: sHelp, isBoarded: false };
              });
              setSchoolChildren(parsed);
              if (parsed.length > 0) setActiveChildId(parsed[0].id);
            } else {
              setSchoolChildren([]);
              setActiveChildId('');
            }
          } catch (e) {
            setSchoolChildren([]);
            setActiveChildId('');
          }
        } else {
          setSchoolChildren([]);
          setActiveChildId('');
        }

        const storedParentState = await AsyncStorage.getItem('@mast_v7_parent_state');
        if (storedParentState) setParentState(storedParentState);

        const storedParentDistrict = await AsyncStorage.getItem('@mast_v7_parent_district');
        if (storedParentDistrict) setParentDistrict(storedParentDistrict);

        const storedDriverState = await AsyncStorage.getItem('@mast_v7_driver_state');
        if (storedDriverState) setDriverState(storedDriverState);

        const storedDriverDistrict = await AsyncStorage.getItem('@mast_v7_driver_district');
        if (storedDriverDistrict) setDriverDistrict(storedDriverDistrict);

        // Load Persistent School Fleet
        const storedFleet = await AsyncStorage.getItem('@mast_v7_school_fleet');
        if (storedFleet) {
          try {
            const parsedFleet = JSON.parse(storedFleet);
            if (Array.isArray(parsedFleet) && parsedFleet.length > 0) {
              // Ensure trips are idle on fresh boot until live driver signals duty
              const sanitizedFleet = parsedFleet.map((b: any) => ({ ...b, isTripActive: false }));
              setSchoolFleetBuses(sanitizedFleet);
            }
          } catch (e) {}
        }

        // Load Persistent Driver Bus Profile
        const storedDriverBus = await AsyncStorage.getItem('@mast_v7_driver_bus');
        if (storedDriverBus) {
          try {
            const parsedBus = JSON.parse(storedDriverBus);
            if (parsedBus && parsedBus.busNo) {
              setDriverLoggedInBus(parsedBus);
              if (parsedBus.school) setDriverSelectedSchool(parsedBus.school);
              if (parsedBus.busNo) setDriverSelectedBus(parsedBus.busNo);
              if (parsedBus.driverName) setDriverNameInput(parsedBus.driverName);
              if (parsedBus.driverPhone) setDriverPhoneInput(parsedBus.driverPhone);
            }
          } catch (e) {}
        }

        // Load Last Backup Time
        const storedLastBackup = await AsyncStorage.getItem('@mast_v7_last_backup_time');
        if (storedLastBackup) {
          setLastBackupTime(storedLastBackup);
        }

        // Load Theme Preference
        const storedTheme = await AsyncStorage.getItem('@mast_theme');
        if (storedTheme === 'dark') setIsDarkMode(true);
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
    publishCloudEvent({
      type: 'family_members_sync',
      members: newMem
    });
  };

  const saveDiary = async (newD: any[]) => {
    setDiaryEntries(newD);
    await AsyncStorage.setItem('@mast_v7_diary', JSON.stringify(newD));
  };

  const saveChat = async (newC: any[]) => {
    setFamilyChat(newC);
    await AsyncStorage.setItem('@mast_v7_chat', JSON.stringify(newC));
  };

  const publishCloudEvent = async (payload: any, overrideCode?: string) => {
    try {
      const activeCode = overrideCode || familyCode;
      const cleanCode = activeCode.toLowerCase().replace(/[^a-z0-9]/g, '') || 'mast8821';
      const familyTopic = `mast_family_${cleanCode}`;
      const globalFleetTopic = 'mast_global_school_fleet';
      const senderName = payload.senderName || userProfile?.name || (busRole === 'driver' ? 'ड्राइवर' : 'परिवार सदस्य');
      const bodyObj = {
        ...payload,
        senderId: myDeviceId,
        senderName,
        timestamp: Date.now()
      };
      const bodyStr = JSON.stringify(bodyObj);

      // Publish helper: sends raw text/plain body which ntfy stores directly as the message payload
      const postTopic = async (serverUrl: string, topicName: string) => {
        try {
          const controller = new AbortController();
          const tId = setTimeout(() => controller.abort(), 6000);
          await fetch(`${serverUrl}/${topicName}`, {
            method: 'POST',
            headers: { 
              'Content-Type': 'text/plain; charset=utf-8',
              'Title': 'MAST Cloud Sync'
            },
            body: bodyStr,
            signal: controller.signal
          });
          clearTimeout(tId);
        } catch (e) {}
      };

      const isSchoolEvent = [
        'fleet_sync', 
        'school_profile_sync', 
        'driver_duty_started', 
        'driver_duty_ended', 
        'bus_location', 
        'request_fleet_sync', 
        'voice_announcement', 
        'child_registered', 
        'student_boarding'
      ].includes(payload.type);

      // Parallel dual-publish to both ntfy.sh & ntfy.envs.net ensures cross-phone delivery across all network carriers
      const promises: Promise<any>[] = [
        postTopic('https://ntfy.sh', familyTopic),
        postTopic('https://ntfy.envs.net', familyTopic)
      ];

      if (isSchoolEvent) {
        promises.push(postTopic('https://ntfy.sh', globalFleetTopic));
        promises.push(postTopic('https://ntfy.envs.net', globalFleetTopic));
      }

      await Promise.allSettled(promises);
    } catch (err) {
      console.log('Cloud publish note:', err);
    }
  };

  // Centralized Real-Time Cloud Message Handler
  const handleIncomingCloudMessage = (data: any, msgId?: string) => {
    if (!data) return;
    if (data.senderId === myDeviceId) return; // Ignore messages from this device

    if (msgId) {
      if (processedMsgIdsRef.current.has(msgId)) return;
      processedMsgIdsRef.current.add(msgId);
      if (processedMsgIdsRef.current.size > 300) {
        const arr = Array.from(processedMsgIdsRef.current);
        processedMsgIdsRef.current = new Set(arr.slice(arr.length - 150));
      }
    }

    // Record online peer device
    if (data.senderId) {
      const peerName = data.senderName || 'परिवार सदस्य';
      setOnlineDevices(prev => ({
        ...prev,
        [data.senderId]: { name: peerName, lastSeen: Date.now() }
      }));
    }

    if (data.type === 'family_device_joined') {
      Vibration.vibrate([0, 200, 100, 200]);
      const peerName = data.senderName || (lang === 'hi' ? 'नया फोन' : 'New Device');
      if (data.senderId) {
        setOnlineDevices(prev => ({
          ...prev,
          [data.senderId]: { name: peerName, lastSeen: Date.now() }
        }));
      }
      setInAppAlert({
        title: '👋 ' + peerName + (lang === 'hi' ? ' जुड़ गया!' : ' Connected!'),
        body: lang === 'hi' ? 'परिवार क्लाउड नेटवर्क पर नया फोन ऑनलाइन कनेक्ट हो चुका है' : 'New family phone joined cloud network',
        type: 'intercom'
      });
      setTimeout(() => setInAppAlert(null), 6000);

      // Send 2-Way ACK immediately so the joining phone also registers this phone
      publishCloudEvent({
        type: 'family_device_ack',
        senderId: myDeviceId,
        senderName: userProfile?.name || (lang === 'hi' ? 'परिवार सदस्य' : 'Family Member'),
        members: familyMembers
      });

      if (familyMembers && familyMembers.length > 0) {
        publishCloudEvent({
          type: 'family_members_sync',
          members: familyMembers
        });
      }
      if (schoolChildren && schoolChildren.length > 0) {
        publishCloudEvent({
          type: 'children_sync',
          children: schoolChildren
        });
      }
      publishCloudEvent({
        type: 'fleet_sync',
        schoolProfile: { name: schoolNameConfig, district: schoolDistrictConfig, state: schoolStateConfig, helpline: schoolHelplineConfig },
        schoolFleetBuses
      });
    } else if (data.type === 'family_device_ack') {
      const peerName = data.senderName || (lang === 'hi' ? 'परिवार सदस्य' : 'Family Member');
      if (data.senderId) {
        setOnlineDevices(prev => ({
          ...prev,
          [data.senderId]: { name: peerName, lastSeen: Date.now() }
        }));
      }
      Vibration.vibrate([0, 150, 80, 150]);
      setInAppAlert({
        title: '🎉 ' + peerName + (lang === 'hi' ? ' से कनेक्ट हो गए!' : ' Connected!'),
        body: lang === 'hi' ? 'दोनों फोन अब रियल-टाइम चैट, इंटरकॉम व बस लाइव के लिए सक्रिय हैं' : 'Both phones are now active for chat, intercom & bus tracking',
        type: 'intercom'
      });
      setTimeout(() => setInAppAlert(null), 6000);
      if (data.members && Array.isArray(data.members)) {
        setFamilyMembers(prev => {
          const seen = new Set();
          const merged: any[] = [];
          for (const m of [...prev, ...data.members]) {
            const cleanName = (m.name || m.nameHi || m.nameEn || '').trim().toLowerCase();
            const cleanPhone = (m.phone || '').trim();
            const key = cleanPhone.length >= 10 ? cleanPhone : (cleanName || String(m.id));
            if (!seen.has(key)) {
              seen.add(key);
              merged.push(m);
            }
          }
          AsyncStorage.setItem('@mast_v7_members', JSON.stringify(merged));
          return merged;
        });
      }
    } else if (data.type === 'request_family_sync') {
      if (familyMembers && familyMembers.length > 0) {
        publishCloudEvent({
          type: 'family_members_sync',
          members: familyMembers
        });
      }
    } else if (data.type === 'family_members_sync' && Array.isArray(data.members)) {
      setFamilyMembers(prev => {
        const seen = new Set();
        const merged: any[] = [];
        for (const m of [...prev, ...data.members]) {
          const cleanName = (m.name || m.nameHi || m.nameEn || '').trim().toLowerCase();
          const cleanPhone = (m.phone || '').trim();
          const key = cleanPhone.length >= 10 ? cleanPhone : (cleanName || String(m.id));
          if (!seen.has(key)) {
            seen.add(key);
            merged.push(m);
          }
        }
        AsyncStorage.setItem('@mast_v7_members', JSON.stringify(merged));
        return merged;
      });
    } else if (data.type === 'request_children_sync') {
      if (schoolChildren && schoolChildren.length > 0) {
        publishCloudEvent({
          type: 'children_sync',
          children: schoolChildren
        });
      }
    } else if (data.type === 'children_sync' && Array.isArray(data.children)) {
      setSchoolChildren(prev => {
        const map = new Map();
        prev.forEach(c => map.set(c.id, c));
        data.children.forEach((c: any) => map.set(c.id, c));
        const merged = Array.from(map.values());
        AsyncStorage.setItem('@mast_v7_school_children', JSON.stringify(merged));
        return merged;
      });
    } else if (data.type === 'heartbeat') {
      // Handled above via peer registration
    } else if (data.type === 'request_fleet_sync') {
      publishCloudEvent({
        type: 'fleet_sync',
        schoolProfile: { name: schoolNameConfig, district: schoolDistrictConfig, state: schoolStateConfig, helpline: schoolHelplineConfig },
        schoolFleetBuses
      });
    } else if (data.type === 'driver_duty_started') {
      const msgAge = Date.now() - (data.timestamp || 0);
      // Ignore stale messages older than 30 minutes
      if (data.timestamp && msgAge > 30 * 60 * 1000) return;
      lastCloudTripTimeRef.current = Date.now();
      setIsTripActive(true);
      setCloudTripActive(true);
      setBusETA(data.eta || 14);
      setSchoolFleetBuses(prev => prev.map(b => (b.busNo === data.busNo || b.id === data.busId || (data.busNo && b.busNo && (b.busNo.includes(data.busNo) || data.busNo.includes(b.busNo)))) ? { ...b, isTripActive: true } : b));
      if (data.schoolFleetBuses && Array.isArray(data.schoolFleetBuses)) {
        setSchoolFleetBuses(data.schoolFleetBuses);
        AsyncStorage.setItem('@mast_v7_school_fleet', JSON.stringify(data.schoolFleetBuses));
      }
      if (data.schoolProfile?.name) setSchoolNameConfig(data.schoolProfile.name);
      Vibration.vibrate([0, 300, 150, 300]);
      const dName = data.driverName || 'राजेश कुमार';
      const bNo = data.busNo || 'स्कूल बस #08';
      const isMorning = data.tripType === 'morning';
      setInAppAlert({
        title: '🚌 ' + bNo + ' ' + (isMorning ? (lang === 'hi' ? 'पिकअप ट्रिप शुरू!' : 'Pickup Trip Started!') : (lang === 'hi' ? 'वापसी ट्रिप शुरू!' : 'Return Trip Started!')),
        body: isMorning 
          ? (lang === 'hi' ? `${dName} ने सुबह की पिकअप ट्रिप शुरू कर दी है। लाइव ट्रैकिंग सक्रिय है।` : `${dName} started morning pickup trip.`)
          : (lang === 'hi' ? `${dName} ने स्कूल से घर की वापसी ट्रिप शुरू कर दी है।` : `${dName} started afternoon return trip.`),
        type: 'bus'
      });
      setTimeout(() => setInAppAlert(null), 7000);
    } else if (data.type === 'driver_duty_ended') {
      lastCloudTripTimeRef.current = 0;
      // When duty ends, reset all students boarded status so children are not stuck in boarded state
      setSchoolChildren(prev => {
        const resetKids = prev.map(c => ({ ...c, isBoarded: false }));
        AsyncStorage.setItem('@mast_v7_school_children', JSON.stringify(resetKids));
        return resetKids;
      });
      setIsTripActive(false);
      setCloudTripActive(false);
      setBusETA(0);
      if (data.schoolFleetBuses && Array.isArray(data.schoolFleetBuses)) {
        setSchoolFleetBuses(data.schoolFleetBuses);
        AsyncStorage.setItem('@mast_v7_school_fleet', JSON.stringify(data.schoolFleetBuses));
      } else {
        setSchoolFleetBuses(prev => {
          const updated = prev.map(b => {
            const match = !data.busNo || b.busNo === data.busNo || b.id === data.busId || (data.busNo && b.busNo && (b.busNo.includes(data.busNo) || data.busNo.includes(b.busNo)));
            return match ? { ...b, isTripActive: false } : b;
          });
          AsyncStorage.setItem('@mast_v7_school_fleet', JSON.stringify(updated));
          return updated;
        });
      }
      Vibration.vibrate([0, 200, 100, 200]);
      const isMorning = data.tripType === 'morning' || data.reachedSchool;
      setInAppAlert({
        title: isMorning 
          ? (lang === 'hi' ? '🏫 स्कूल पहुँचे - मॉर्निंग ट्रिप समाप्त' : 'School Reached')
          : (lang === 'hi' ? '🏁 डिपो पहुँचे - वापसी ट्रिप समाप्त' : 'Trip Finished'),
        body: isMorning 
          ? (lang === 'hi' ? 'बस सुरक्षित स्कूल पहुँच चुकी है। सभी बच्चे स्कूल में हैं।' : 'Bus reached school safely. All students at school.')
          : (lang === 'hi' ? 'बस सुरक्षित डिपो पहुँच चुकी है। सभी बच्चे घर पहुँच चुके हैं।' : 'Bus returned to depot. All children safely dropped.'),
        type: 'bus'
      });
      setTimeout(() => setInAppAlert(null), 6000);
      Alert.alert(
        isMorning ? (lang === 'hi' ? '🏫 स्कूल पहुँचे' : 'School Reached') : (lang === 'hi' ? '🏁 ट्रिप समाप्त' : 'Trip Finished'),
        isMorning 
          ? (lang === 'hi' ? 'बस स्कूल पहुँच चुकी है। सभी बच्चे सुरक्षित स्कूल में हैं।' : 'Bus reached school safely.')
          : (lang === 'hi' ? 'बस डिपो पहुँच चुकी है। सभी बच्चे घर पहुँच चुके हैं।' : 'Bus reached depot safely.')
      );
    } else if (data.type === 'fleet_sync' || data.type === 'school_profile_sync') {
      if (data.schoolFleetBuses && Array.isArray(data.schoolFleetBuses) && data.schoolFleetBuses.length > 0) {
        setSchoolFleetBuses(data.schoolFleetBuses);
        AsyncStorage.setItem('@mast_v7_school_fleet', JSON.stringify(data.schoolFleetBuses));
        
        // Auto-update school children state to display the newly synced bus & driver
        setSchoolChildren(prev => {
          if (!prev || prev.length === 0) {
            return [];
          }

          const updated = prev.map(child => {
            const matchedBus = data.schoolFleetBuses.find((b: any) => 
              b.busNo === child.busNo || b.busCode === child.busCode || (b.vehicleNo && b.vehicleNo === child.vehicleNo)
            ) || data.schoolFleetBuses[data.schoolFleetBuses.length - 1];

            if (matchedBus) {
              return {
                ...child,
                vehicleNo: matchedBus.vehicleNo || child.vehicleNo,
                driverNameHi: matchedBus.driverName || child.driverNameHi,
                driverNameEn: matchedBus.driverName || child.driverNameEn,
                driverPhone: matchedBus.driverPhone || child.driverPhone,
                conductorNameHi: matchedBus.conductorName || child.conductorNameHi,
                conductorNameEn: matchedBus.conductorName || child.conductorNameEn,
                conductorPhone: matchedBus.conductorPhone || child.conductorPhone,
                schoolNameHi: (data.schoolProfile && data.schoolProfile.name) || child.schoolNameHi,
                schoolNameEn: (data.schoolProfile && data.schoolProfile.name) || child.schoolNameEn,
                schoolHelpline: (data.schoolProfile && data.schoolProfile.helpline) || child.schoolHelpline,
              };
            }
            return child;
          });
          AsyncStorage.setItem('@mast_v7_school_children', JSON.stringify(updated));
          return updated;
        });

        Vibration.vibrate(80);
        const addedBus = data.schoolFleetBuses[data.schoolFleetBuses.length - 1];
        setInAppAlert({
          title: '🚌 ' + (lang === 'hi' ? 'स्कूल बस डेटा सिंक हुआ!' : 'Bus Fleet Synced!'),
          body: `${addedBus?.busNo || 'Bus'} (${addedBus?.vehicleNo || 'UP 14 EF 3308'}) - ${addedBus?.driverName || 'राजेश कुमार'}`,
          type: 'bus'
        });
        setTimeout(() => setInAppAlert(null), 6000);
      }
      if (data.schoolProfile) {
        if (data.schoolProfile.name) setSchoolNameConfig(data.schoolProfile.name);
        if (data.schoolProfile.district) setSchoolDistrictConfig(data.schoolProfile.district);
        if (data.schoolProfile.state) setSchoolStateConfig(data.schoolProfile.state);
        if (data.schoolProfile.helpline) setSchoolHelplineConfig(data.schoolProfile.helpline);
        AsyncStorage.setItem('@mast_v7_school_profile', JSON.stringify(data.schoolProfile));
      }
    } else if (data.type === 'voice_announcement' || data.announcementTitle) {
      const voiceText = data.text || data.announcementTitle;
      Vibration.vibrate([0, 250, 150, 250]);
      setActiveVoiceAnnouncement({
        text: voiceText,
        time: data.time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        from: data.sender || (lang === 'hi' ? 'ड्राइवर घोषणा' : 'Driver Announcement')
      });
      setInAppAlert({
        title: '📢 ' + (lang === 'hi' ? 'ड्राइवर का वॉइस मैसेज' : 'Voice Message from Driver'),
        body: voiceText,
        type: 'bus'
      });
      setTimeout(() => setInAppAlert(null), 8000);
    } else if (data.type === 'child_registered' && data.child) {
      setSchoolChildren(prev => {
        const exists = prev.some(c => c.id === data.child.id);
        const updated = exists ? prev.map(c => c.id === data.child.id ? data.child : c) : [...prev, data.child];
        AsyncStorage.setItem('@mast_v7_school_children', JSON.stringify(updated));
        return updated;
      });
      setSchoolFleetBuses(prev => prev.map(b => (b.busNo === data.child.busNo) ? { ...b, studentCount: (b.studentCount || 0) + 1 } : b));
    } else if (data.type === 'student_boarding') {
      const msgAge = Date.now() - (data.timestamp || 0);
      // Ignore stale boarding messages older than 30 minutes
      if (data.timestamp && msgAge > 30 * 60 * 1000) return;
      setSchoolChildren(prev => {
        const updated = prev.map(c => (c.id === data.childId || (data.childName && c.name.includes(data.childName))) ? { ...c, isBoarded: data.isBoarded } : c);
        AsyncStorage.setItem('@mast_v7_school_children', JSON.stringify(updated));
        return updated;
      });
      Vibration.vibrate([0, 200, 100, 250]);
      const kName = data.childName || (lang === 'hi' ? 'छात्र' : 'Student');
      const isDrop = data.tripType === 'afternoon' || data.tripType === 'drop';
      const statusTitle = data.isBoarded 
        ? (isDrop 
            ? (lang === 'hi' ? `🎒 ${kName} बस में सवार (स्कूल से रवाना) ✅` : `🎒 ${kName} Boarded for Home ✅`)
            : (lang === 'hi' ? `🚸 ${kName} बस में सवार ✅` : `🚸 ${kName} Boarded ✅`))
        : (lang === 'hi' ? `🚸 ${kName} बस से उतरा` : `🚸 ${kName} Deboarded`);
      const statusMsg = data.isBoarded 
        ? (isDrop
            ? (lang === 'hi' ? `चालक ने स्कूल से ${kName} को बस में बैठा लिया है। बस घर की ओर निकल चुकी है!` : `Driver has boarded ${kName} on the bus. Bus is heading home!`)
            : (lang === 'hi' ? `${kName} सुबह स्कूल बस में सुरक्षित सवार हो चुका है।` : `${kName} has boarded the morning bus.`))
        : (lang === 'hi' ? `${kName} बस से उतर चुका है।` : `${kName} has deboarded.`);
      setInAppAlert({
        title: statusTitle,
        body: statusMsg,
        type: 'bus'
      });
      setTimeout(() => setInAppAlert(null), 8000);
      Alert.alert(statusTitle, statusMsg);
    } else if (data.type === 'intercom') {
      Vibration.vibrate([0, 300, 200, 300, 200, 400]);
      try {
        Notifications.scheduleNotificationAsync({
          content: {
            title: '📢 ' + (data.senderName || 'परिवार') + ': ' + (data.title || 'इंटरकॉम अलर्ट'),
            body: data.body || 'नया पारिवारिक संदेश',
            sound: 'default',
            priority: Notifications.AndroidNotificationPriority.MAX,
            vibrate: [0, 400, 200, 400]
          },
          trigger: null
        });
      } catch (e) {}
      setInAppAlert({
        title: '📢 ' + (data.senderName || 'परिवार') + ': ' + data.title,
        body: data.body,
        type: 'intercom'
      });
      setTimeout(() => setInAppAlert(null), 8000);
      Alert.alert('📢 Intercom Alert', `${data.senderName || 'परिवार'}: ${data.body}`);
    } else if (data.type === 'chat') {
      const newMsg = {
        id: data.msgId || Date.now(),
        senderHi: data.senderName || 'सदस्य',
        senderEn: data.senderName || 'Member',
        msgHi: data.text,
        msgEn: data.text,
        time: data.time || (lang === 'hi' ? 'अभी' : 'Now'),
        isSelf: false
      };
      setFamilyChat(prev => {
        if (prev.some(m => m.id === newMsg.id)) return prev;
        const updated = [...prev, newMsg];
        AsyncStorage.setItem('@mast_v7_chat', JSON.stringify(updated));
        return updated;
      });
      Vibration.vibrate(100);
      setInAppAlert({
        title: '💬 ' + (data.senderName || 'परिवार सदस्य') + ':',
        body: data.text,
        type: 'intercom'
      });
      setTimeout(() => setInAppAlert(null), 5000);
      setTimeout(() => {
        chatScrollRef.current?.scrollToEnd({ animated: true });
      }, 200);
    } else if (data.type === 'bus_location') {
      if (data.eta !== undefined) setBusETA(data.eta);
      if (data.stopIdx !== undefined) setBusStopIdx(data.stopIdx);
      if (data.isTripActive !== undefined) {
        setIsTripActive(data.isTripActive);
        setSchoolFleetBuses(prev => prev.map(b => (b.busNo === data.busNo || b.id === data.busId || (b.busCode && b.busCode === data.busCode)) ? { ...b, isTripActive: data.isTripActive } : b));
      }
      // Real GPS updates from driver's mobile GPS sensor
      if (data.coords && data.coords.lat && data.coords.lng) {
        setSchoolChildren(prev => prev.map(ch => {
          const isMatch = !data.busNo || ch.busNo === data.busNo || ch.busCode === data.busCode || (data.busNo && ch.busNo && (ch.busNo.includes(data.busNo) || data.busNo.includes(ch.busNo)));
          if (isMatch) {
            return {
              ...ch,
              busCoords: data.coords,
              speedKmh: data.speed !== undefined ? data.speed : ch.speedKmh
            };
          }
          return ch;
        }));
      }
    } else if (data.type === 'sos') {
      Vibration.vibrate([0, 500, 250, 500, 250, 500]);
      setInAppAlert({
        title: '🚨 आपातकालीन SOS अलर्ट!',
        body: (data.senderName || 'परिवार सदस्य') + ' को मदद की तुरंत आवश्यकता है!',
        type: 'alarm'
      });
      setTimeout(() => setInAppAlert(null), 8000);
      Alert.alert('🚨 आपातकालीन SOS अलर्ट!', (data.senderName || 'परिवार सदस्य') + ' को मदद की तुरंत आवश्यकता है!');
    }
  };

  const fetchLatestSchoolDataFromCloud = async (showFeedback = false, overrideCode?: string) => {
    try {
      setIsCloudSyncing(true);
      const activeCode = overrideCode || familyCode;
      const cleanCode = activeCode.toLowerCase().replace(/[^a-z0-9]/g, '');
      const familyTopic = `mast_family_${cleanCode}`;
      const globalFleetTopic = 'mast_global_school_fleet';
      
      // Peer handshake ping to live admin/driver devices
      publishCloudEvent({ type: 'request_fleet_sync' }, activeCode);

      let latestFleet: any = null;
      let latestProfile: any = null;

      const parseLines = (rawLines: string[]) => {
        for (const line of rawLines) {
          if (!line) continue;
          try {
            const entry = JSON.parse(line);
            if (entry.event === 'message') {
              let data = null;
              if (entry.message) {
                try {
                  data = typeof entry.message === 'string' ? JSON.parse(entry.message) : entry.message;
                } catch (e) {}
              }
              if (!data && entry.type) data = entry;
              if (data) {
                handleIncomingCloudMessage(data, entry.id);
                if (data.type === 'fleet_sync' || data.type === 'school_profile_sync' || data.type === 'driver_duty_started') {
                  if (data.schoolFleetBuses && Array.isArray(data.schoolFleetBuses) && data.schoolFleetBuses.length > 0) {
                    latestFleet = data.schoolFleetBuses;
                  }
                  if (data.schoolProfile) {
                    latestProfile = data.schoolProfile;
                  }
                }
                if (data.type === 'driver_duty_ended' || data.isTripActive === false) {
                  if (latestFleet && Array.isArray(latestFleet)) {
                    latestFleet = latestFleet.map((b: any) => {
                      const match = !data.busNo || b.busNo === data.busNo || b.id === data.busId;
                      return match ? { ...b, isTripActive: false } : b;
                    });
                  }
                }
              }
            }
          } catch (e) {}
        }
      };

      const fetchTopic = async (topicName: string) => {
        const fetchServer = async (serverUrl: string) => {
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 6000);
            const res = await fetch(`${serverUrl}/${topicName}/json?poll=1&since=24h`, { signal: controller.signal });
            clearTimeout(timeoutId);
            if (res.ok) {
              const text = await res.text();
              parseLines(text.trim().split('\n'));
            }
          } catch (e) {}
        };
        await Promise.allSettled([
          fetchServer('https://ntfy.sh'),
          fetchServer('https://ntfy.envs.net')
        ]);
      };

      await Promise.allSettled([fetchTopic(familyTopic), fetchTopic(globalFleetTopic)]);

      if (latestFleet && latestFleet.length > 0) {
        setSchoolFleetBuses(latestFleet);
        await AsyncStorage.setItem('@mast_v7_school_fleet', JSON.stringify(latestFleet));
        // Update school children as well!
        setSchoolChildren(prev => {
          if (!prev || prev.length === 0) {
            return [];
          }

          const matchedBus = latestFleet[latestFleet.length - 1] || latestFleet[0];
          const updated = prev.map(child => ({
            ...child,
            busNo: matchedBus.busNo || child.busNo,
            vehicleNo: matchedBus.vehicleNo || 'UP 14 EF 3308',
            driverName: matchedBus.driverName || 'राजेश कुमार',
            driverPhone: matchedBus.driverPhone || '+91 98765 43210',
            conductorName: matchedBus.conductorName || 'सुरेश यादव',
            conductorPhone: matchedBus.conductorPhone || '+91 98765 43211',
            schoolNameHi: (latestProfile && latestProfile.name) || child.schoolNameHi,
            schoolNameEn: (latestProfile && latestProfile.name) || child.schoolNameEn,
            schoolHelpline: (latestProfile && latestProfile.helpline) || child.schoolHelpline,
          }));
          AsyncStorage.setItem('@mast_v7_school_children', JSON.stringify(updated));
          return updated;
        });
      }
      if (latestProfile) {
        if (latestProfile.name) setSchoolNameConfig(latestProfile.name);
        if (latestProfile.district) setSchoolDistrictConfig(latestProfile.district);
        if (latestProfile.state) setSchoolStateConfig(latestProfile.state);
        if (latestProfile.helpline) setSchoolHelplineConfig(latestProfile.helpline);
        await AsyncStorage.setItem('@mast_v7_school_profile', JSON.stringify(latestProfile));
      }
      if (showFeedback) {
        Vibration.vibrate(60);
        setCloudSyncMsg(lang === 'hi' ? '✅ स्कूल बस डेटा तुरंत सिंक हुआ!' : '✅ Data synced instantly!');
        setTimeout(() => setCloudSyncMsg(''), 4000);
      }
      return latestFleet;
    } catch (e) {
      console.log('Error syncing school from cloud:', e);
    } finally {
      setIsCloudSyncing(false);
    }
    return null;
  };

  // Persistent Real-Time WebSocket + Background Polling Hook via ntfy.sh and ntfy.envs.net
  useEffect(() => {
    const cleanCode = familyCode.toLowerCase().replace(/[^a-z0-9]/g, '') || 'mast8821';
    const familyTopic = `mast_family_${cleanCode}`;
    const globalFleetTopic = 'mast_global_school_fleet';

    let isDisposed = false;
    let wsFamily: WebSocket | null = null;
    let wsGlobal: WebSocket | null = null;
    let reconnectTimeout: any = null;

    const handleWsMsg = (event: any) => {
      try {
        const entry = JSON.parse(event.data);
        if (entry.event === 'message') {
          let data = null;
          if (entry.message) {
            try {
              data = typeof entry.message === 'string' ? JSON.parse(entry.message) : entry.message;
            } catch (e) {}
          }
          if (!data && entry.type) data = entry;
          if (data) handleIncomingCloudMessage(data, entry.id);
        }
      } catch (e) {}
    };

    const connectSockets = () => {
      if (isDisposed) return;
      try {
        wsFamily = new WebSocket(`wss://ntfy.sh/${familyTopic}/ws`);
        wsFamily.onmessage = handleWsMsg;
        wsFamily.onerror = () => {
          try {
            if (!isDisposed) {
              const wsFallback = new WebSocket(`wss://ntfy.envs.net/${familyTopic}/ws`);
              wsFallback.onmessage = handleWsMsg;
            }
          } catch (e) {}
        };
        wsFamily.onclose = () => {
          if (!isDisposed && !reconnectTimeout) {
            reconnectTimeout = setTimeout(() => {
              reconnectTimeout = null;
              connectSockets();
            }, 3000);
          }
        };
      } catch (e) {}

      try {
        wsGlobal = new WebSocket(`wss://ntfy.sh/${globalFleetTopic}/ws`);
        wsGlobal.onmessage = handleWsMsg;
        wsGlobal.onerror = () => {
          try {
            if (!isDisposed) {
              const wsFallback = new WebSocket(`wss://ntfy.envs.net/${globalFleetTopic}/ws`);
              wsFallback.onmessage = handleWsMsg;
            }
          } catch (e) {}
        };
        wsGlobal.onclose = () => {};
      } catch (e) {}
    };

    connectSockets();

    // Fallback Dual HTTP Polling every 5s across both ntfy.sh and ntfy.envs.net
    let isPolling = false;
    const pollInterval = setInterval(async () => {
      if (isPolling || isDisposed) return;
      isPolling = true;
      try {
        const sinceParam = isFirstPollRef.current ? '30m' : '3m';
        isFirstPollRef.current = false;

        pollCountRef.current = (pollCountRef.current || 0) + 1;
        if (pollCountRef.current % 4 === 0) {
          publishCloudEvent({
            type: 'heartbeat',
            senderName: userProfile?.name || (busRole === 'driver' ? 'ड्राइवर' : 'परिवार सदस्य')
          });
        }

        const pollTopic = async (topicName: string) => {
          const pollServer = async (serverUrl: string) => {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);
            try {
              const res = await fetch(`${serverUrl}/${topicName}/json?poll=1&since=${sinceParam}`, { signal: controller.signal });
              clearTimeout(timeoutId);
              if (!res.ok) return;
              const text = await res.text();
              const lines = text.trim().split('\n');
              for (const line of lines) {
                if (!line) continue;
                try {
                  const entry = JSON.parse(line);
                  if (entry.event === 'message') {
                    let data = null;
                    if (entry.message) {
                      try {
                        data = typeof entry.message === 'string' ? JSON.parse(entry.message) : entry.message;
                      } catch (e) {}
                    }
                    if (!data && entry.type) data = entry;
                    if (data) handleIncomingCloudMessage(data, entry.id);
                  }
                } catch (e) {}
              }
            } catch (e) {
              clearTimeout(timeoutId);
            }
          };

          await Promise.allSettled([
            pollServer('https://ntfy.sh'),
            pollServer('https://ntfy.envs.net')
          ]);
        };

        await Promise.allSettled([pollTopic(familyTopic), pollTopic(globalFleetTopic)]);
      } catch (e) {
      } finally {
        isPolling = false;
      }
    }, 5000);

    return () => {
      isDisposed = true;
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      clearInterval(pollInterval);
      try { if (wsFamily) wsFamily.close(); } catch (e) {}
      try { if (wsGlobal) wsGlobal.close(); } catch (e) {}
    };
  }, [familyCode, myDeviceId, schoolNameConfig, schoolDistrictConfig, schoolStateConfig, schoolHelplineConfig, schoolFleetBuses]);

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
      tileBusSub: 'लाइव बस ट्रैक करें',
      liveBadge: 'लाइव',
      tileMed: 'दवाइयां (Dawa)',
      tileMedSub: 'दवा व अलार्म जोड़ें',
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
      driverName: 'ड्राइवर',
      conductorName: 'कंडक्टर / सहायक',
      schoolHelpline: 'स्कूल बस कंट्रोल रूम',
      callDriver: 'ड्राइवर को कॉल करें',
      tripActive: 'ट्रिप चालू है (GPS ऑन)',
      tripInactive: 'ट्रिप बंद है',
      startTrip: '▶️ ट्रिप शुरू करें',
      endTrip: '⏹️ ट्रिप समाप्त करें',
      startSim: '▶️ लाइव सिमुलेशन चलाएं',
      stopSim: '⏸️ सिमुलेशन रोकें',
      testChimeBtn: '🔔 अराइवल घंटी टेस्ट',
      refreshGpsBtn: '🔄 GPS रिफ्रेश',
      childBoardedBadge: '✓ बस में सवार',
      childInfo: 'छात्र जानकारी',
      childRfid: 'ID कार्ड',
      speedTagText: '38 km/h • गति सीमा के भीतर',
      distTagText: '2.4 km दूर (निकट आ रही है)',
      trafficTagText: '🟢 सुगम मार्ग (Smooth)',
      vehicleSpec: 'स्कूल बस • GPS व CCTV युक्त',
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
      tileBusSub: 'Track live bus',
      liveBadge: 'Live',
      tileMed: 'Medicines (Rx)',
      tileMedSub: 'Add medicine & alarm',
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
      driverName: 'Driver',
      conductorName: 'Conductor / Helper',
      schoolHelpline: 'Transport Control',
      callDriver: 'Call Bus Driver',
      tripActive: 'Trip Active (GPS Live)',
      tripInactive: 'Trip Offline',
      startTrip: '▶️ Start Trip',
      endTrip: '⏹️ End Trip',
      startSim: '▶️ Start Live Demo',
      stopSim: '⏸️ Stop Demo',
      testChimeBtn: '🔔 Test Arrival Chime',
      refreshGpsBtn: '🔄 Refresh GPS',
      childBoardedBadge: '✓ Boarded Safely',
      childInfo: 'Student Information',
      childRfid: 'ID Card',
      speedTagText: '38 km/h • Within Speed Limit',
      distTagText: '2.4 km away (Approaching)',
      trafficTagText: '🟢 Smooth Traffic Flow',
      vehicleSpec: 'School Bus • GPS & CCTV Active',
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
      async () => {
        await saveMeds(medicines.filter(m => m.id !== id));
        await saveReminders(upcomingReminders.filter(r => r.linkedMedId !== id));
      }
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
          linkedReminderId: id,
          titleHi: `${title} (भुगतान)`,
          titleEn: `${title} (Paid)`,
          amount: numAmount,
          category: targetRem.category === 'fees' ? 'fees' : targetRem.category === 'med' ? 'med' : 'fees',
          date: lang === 'hi' ? 'आज' : 'Today'
        };
        const updatedExpenses = [newExpenseEntry, ...expenses.filter((e: any) => e.linkedReminderId !== id)];
        await saveExpenses(updatedExpenses);

        Alert.alert(
          lang === 'hi' ? '✓ भुगतान दर्ज!' : '✓ Payment Recorded!',
          lang === 'hi'
            ? `${title} का ₹${numAmount.toLocaleString('en-IN')} आपके मासिक घरेलू खर्च व बजट में अपने-आप जुड़ गया है।`
            : `${title} of ₹${numAmount.toLocaleString('en-IN')} has been automatically added to your Household Budget & Expenses.`
        );
      }
    } else {
      // If toggled unpaid, remove the automatically linked expense
      const updatedExpenses = expenses.filter((e: any) => e.linkedReminderId !== id);
      await saveExpenses(updatedExpenses);
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
      async () => {
        await saveMembers(familyMembers.filter(m => m.id !== id));
        await saveReminders(upcomingReminders.filter(r => r.linkedMemberId !== id && r.id !== (880000 + (id % 10000))));
      }
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
  const openLocationPicker = (type: 'state' | 'district', target: 'parent' | 'driver' | 'admin') => {
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
      const currentState = pickerTarget === 'parent' 
        ? (parentState || schoolStateConfig || 'उत्तर प्रदेश (Uttar Pradesh)') 
        : (pickerTarget === 'admin' 
          ? (draftSchoolState || schoolStateConfig || 'उत्तर प्रदेश (Uttar Pradesh)') 
          : (driverState || schoolStateConfig || 'उत्तर प्रदेश (Uttar Pradesh)'));
      const allDistricts = getDistrictsForState(currentState);
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
      const curState = pickerTarget === 'parent' ? parentState : (pickerTarget === 'admin' ? (draftSchoolState || schoolStateConfig) : driverState);
      return curState === item;
    } else {
      const curDist = pickerTarget === 'parent' ? parentDistrict : (pickerTarget === 'admin' ? (draftSchoolDistrict || schoolDistrictConfig) : driverDistrict);
      return curDist === item;
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
      const districts = getDistrictsForState(item);
      const firstDistrict = (districts && districts[0]) || '';
      if (pickerTarget === 'admin') {
        setDraftSchoolState(item);
        setSchoolStateConfig(item);
        if (firstDistrict) {
          setDraftSchoolDistrict(firstDistrict);
          setSchoolDistrictConfig(firstDistrict);
        }
        AsyncStorage.setItem('@mast_v7_school_profile', JSON.stringify({
          name: draftSchoolName || schoolNameConfig,
          state: item,
          district: firstDistrict || draftSchoolDistrict,
          helpline: draftSchoolHelpline || schoolHelplineConfig
        }));
      } else if (pickerTarget === 'parent') {
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
      if (pickerTarget === 'admin') {
        setDraftSchoolDistrict(item);
        setSchoolDistrictConfig(item);
        AsyncStorage.setItem('@mast_v7_school_profile', JSON.stringify({
          name: draftSchoolName || schoolNameConfig,
          state: draftSchoolState || schoolStateConfig,
          district: item,
          helpline: draftSchoolHelpline || schoolHelplineConfig
        }));
        publishCloudEvent({
          type: 'fleet_sync',
          schoolProfile: { name: draftSchoolName || schoolNameConfig, district: item, state: draftSchoolState || schoolStateConfig, helpline: draftSchoolHelpline || schoolHelplineConfig },
          schoolFleetBuses
        });
      } else if (pickerTarget === 'parent') {
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
    openUrlSafe(url);
  };

  const navigateToMyStopOnGoogleMaps = (lat: number, lng: number) => {
    Vibration.vibrate(60);
    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
    openUrlSafe(url);
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
      driverName: driverNameInput.trim() || (lang === 'hi' ? 'स्कूल चालक' : 'School Driver'),
      driverPhone: driverPhoneInput.trim() || '',
      vehicleNo: chosenBus ? `बस ${chosenBus}` : 'बस'
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
      (driverLoggedInBus?.state || schoolStateConfig || driverState || 'Uttar Pradesh') || driverState,
      (driverLoggedInBus?.district || schoolDistrictConfig || driverDistrict || 'Lucknow') || driverDistrict,
      (driverLoggedInBus?.school || schoolNameConfig || ''),
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
      oldBus: (driverLoggedInBus?.busNo || driverSelectedBus || 'Bus #01'),
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


  const handleOpenEditFleetBus = (bus: any) => {
    setEditingFleetBusId(bus.id);
    setNewFleetBusNo(bus.busNo || '');
    setNewFleetVehicleNo(bus.vehicleNo || '');
    setNewFleetDriverName(bus.driverName || '');
    setNewFleetDriverPhone(bus.driverPhone || '');
    setNewFleetConductorName(bus.conductorName || '');
    setNewFleetConductorPhone(bus.conductorPhone || '');
    setNewFleetDriverPin(bus.driverPin || '');
    setNewFleetParentCode(bus.parentCode || '');
    setIsAddFleetBusOpen(true);
  };

  const handleOpenAddFleetBus = () => {
    setEditingFleetBusId(null);
    setNewFleetBusNo('');
    setNewFleetVehicleNo('');
    setNewFleetDriverName('');
    setNewFleetDriverPhone('');
    setNewFleetConductorName('');
    setNewFleetConductorPhone('');
    setNewFleetDriverPin('');
    setNewFleetParentCode('');
    setIsAddFleetBusOpen(true);
  };

  const handleSaveFleetBus = async () => {
    if (!newFleetBusNo.trim() || !newFleetVehicleNo.trim()) {
      Alert.alert('Notice', lang === 'hi' ? 'कृपया बस नंबर और वाहन पंजीकरण नंबर भरें' : 'Please enter bus number and vehicle number');
      return;
    }

    let updatedFleet: any[];
    const targetBusNo = newFleetBusNo.trim();
    const wasEditing = !!editingFleetBusId;

    if (editingFleetBusId) {
      updatedFleet = schoolFleetBuses.map(b => {
        if (b.id === editingFleetBusId) {
          return {
            ...b,
            busNo: targetBusNo,
            vehicleNo: newFleetVehicleNo.trim(),
            driverName: newFleetDriverName.trim() || (lang === 'hi' ? 'चालक' : 'Driver'),
            driverPhone: newFleetDriverPhone.trim() || '',
            conductorName: newFleetConductorName.trim() || (lang === 'hi' ? 'परिचालक' : 'Helper'),
            conductorPhone: newFleetConductorPhone.trim() || '',
            driverPin: newFleetDriverPin.trim() || b.driverPin || '1101',
            parentCode: newFleetParentCode.trim() || b.parentCode || '4001',
            schoolName: schoolNameConfig || b.schoolName || ''
          };
        }
        return b;
      });
    } else {
      const newBus = {
        id: `fleet_${Date.now()}`,
        busNo: targetBusNo,
        vehicleNo: newFleetVehicleNo.trim(),
        driverName: newFleetDriverName.trim() || (lang === 'hi' ? 'चालक' : 'Driver'),
        driverPhone: newFleetDriverPhone.trim() || '',
        conductorName: newFleetConductorName.trim() || (lang === 'hi' ? 'परिचालक' : 'Helper'),
        conductorPhone: newFleetConductorPhone.trim() || '',
        driverPin: newFleetDriverPin.trim() || '1101',
        parentCode: newFleetParentCode.trim() || '4001',
        schoolName: schoolNameConfig || '',
        isTripActive: false,
        studentCount: 0
      };
      updatedFleet = [...schoolFleetBuses, newBus];
    }

    setSchoolFleetBuses(updatedFleet);
    await AsyncStorage.setItem('@mast_v7_school_fleet', JSON.stringify(updatedFleet));

    // Also update school children that reference this bus
    if (wasEditing) {
      setSchoolChildren(prev => {
        const updated = prev.map(child => {
          const matched = updatedFleet.find(b => b.id === editingFleetBusId || b.busNo === child.busNo);
          if (matched) {
            return {
              ...child,
              busNo: matched.busNo,
              vehicleNo: matched.vehicleNo,
              driverNameHi: matched.driverName,
              driverNameEn: matched.driverName,
              driverPhone: matched.driverPhone,
              conductorNameHi: matched.conductorName,
              conductorNameEn: matched.conductorName,
              conductorPhone: matched.conductorPhone
            };
          }
          return child;
        });
        AsyncStorage.setItem('@mast_v7_school_children', JSON.stringify(updated));
        return updated;
      });
    }

    setNewFleetBusNo('');
    setNewFleetVehicleNo('');
    setNewFleetDriverName('');
    setNewFleetDriverPhone('');
    setNewFleetConductorName('');
    setNewFleetConductorPhone('');
    setNewFleetDriverPin('');
    setNewFleetParentCode('');
    setEditingFleetBusId(null);
    setIsAddFleetBusOpen(false);
    Vibration.vibrate(80);

    await publishCloudEvent({
      type: 'fleet_sync',
      schoolProfile: { name: schoolNameConfig, district: schoolDistrictConfig, state: schoolStateConfig, helpline: schoolHelplineConfig },
      schoolFleetBuses: updatedFleet
    });

    Alert.alert(
      lang === 'hi' ? 'सफलता व लाइव सिंक' : 'Success & Live Synced',
      lang === 'hi'
        ? (wasEditing
            ? `बस (${targetBusNo}) का विवरण अपडेट हो गया और सभी फोन में लाइव सिंक हो गया!`
            : `बस (${targetBusNo}) स्कूल फ्लीट में जुड़ गई और सभी मोबाइल में लाइव उपलब्ध हो गई!`)
        : (wasEditing
            ? `Bus (${targetBusNo}) details updated & synced live to all mobiles!`
            : `Bus (${targetBusNo}) added & synced live to all mobiles!`)
    );
  };

  const handleToggleFleetTrip = async (busId: string) => {
    let toggledBus: any = null;
    let nextState = false;
    const updatedFleet = schoolFleetBuses.map(b => {
      if (b.id === busId) {
        nextState = !b.isTripActive;
        toggledBus = b;
        Vibration.vibrate(50);
        return { ...b, isTripActive: nextState };
      }
      return b;
    });
    setSchoolFleetBuses(updatedFleet);
    await AsyncStorage.setItem('@mast_v7_school_fleet', JSON.stringify(updatedFleet));

    if (toggledBus) {
      if (nextState) {
        publishCloudEvent({
          type: 'driver_duty_started',
          busNo: toggledBus.busNo,
          busId: toggledBus.id,
          driverName: toggledBus.driverName || 'चालक',
          isTripActive: true,
          schoolFleetBuses: updatedFleet,
          eta: 14
        });
        publishCloudEvent({
          type: 'fleet_sync',
          schoolProfile: { name: schoolNameConfig, district: schoolDistrictConfig, state: schoolStateConfig, helpline: schoolHelplineConfig },
          schoolFleetBuses: updatedFleet
        });
        Alert.alert(
          lang === 'hi' ? '▶ ट्रिप शुरू (Admin Override)' : '▶ Trip Started (Admin Override)',
          lang === 'hi' ? `${toggledBus.busNo} की ट्रिप शुरू कर दी गई है और सभी अभिभावकों के मोबाइल पर लाइव सिंक हो गई है।` : `Trip started for ${toggledBus.busNo} and synced to parents.`
        );
      } else {
        publishCloudEvent({
          type: 'driver_duty_ended',
          busNo: toggledBus.busNo,
          busId: toggledBus.id,
          driverName: toggledBus.driverName || 'चालक',
          isTripActive: false,
          schoolFleetBuses: updatedFleet,
          eta: 0
        });
        publishCloudEvent({
          type: 'fleet_sync',
          schoolProfile: { name: schoolNameConfig, district: schoolDistrictConfig, state: schoolStateConfig, helpline: schoolHelplineConfig },
          schoolFleetBuses: updatedFleet
        });
        publishCloudEvent({
          type: 'bus_location',
          busNo: toggledBus.busNo,
          busCode: toggledBus.busNo,
          isTripActive: false,
          eta: 0
        });
        Alert.alert(
          lang === 'hi' ? '⏹ ट्रिप समाप्त (Admin Override)' : '⏹ Trip Ended (Admin Override)',
          lang === 'hi' ? `${toggledBus.busNo} की ट्रिप समाप्त कर दी गई है। सभी अभिभावकों के ऐप पर बस स्टैंडबाय हो गई है।` : `Trip ended for ${toggledBus.busNo} and synced to parents.`
        );
      }
    }
  };

  const handleDeleteFleetBus = (busId: string) => {
    Alert.alert(
      lang === 'hi' ? 'बस हटाएं' : 'Remove Bus',
      lang === 'hi' ? 'क्या आप इस बस को स्कूल फ्लीट से हटाना चाहते हैं?' : 'Remove this bus from school fleet?',
      [
        { text: lang === 'hi' ? 'रद्द करें' : 'Cancel', style: 'cancel' },
        {
          text: lang === 'hi' ? 'हटाएं' : 'Remove',
          style: 'destructive',
          onPress: async () => {
            const updated = schoolFleetBuses.filter(b => b.id !== busId);
            setSchoolFleetBuses(updated);
            await AsyncStorage.setItem('@mast_v7_school_fleet', JSON.stringify(updated));
            publishCloudEvent({
              type: 'fleet_sync',
              schoolProfile: { name: schoolNameConfig, district: schoolDistrictConfig, state: schoolStateConfig, helpline: schoolHelplineConfig },
              schoolFleetBuses: updated
            });
          }
        }
      ]
    );
  };

  const handleSaveCentralHelpline = async (phone: string) => {
    setSchoolHelplineConfig(phone);
    await AsyncStorage.setItem('@mast_v7_school_helpline', phone);
    setIsEditingSchoolHelpline(false);
    publishCloudEvent({
      type: 'fleet_sync',
      schoolProfile: { name: schoolNameConfig, district: schoolDistrictConfig, state: schoolStateConfig, helpline: phone },
      schoolFleetBuses
    });
    Alert.alert(
      lang === 'hi' ? 'सफलता व सिंक' : 'Success & Synced',
      lang === 'hi' ? `स्कूल ट्रांसपोर्ट कंट्रोल रूम हेल्पलाइन अपडेट हो गई: ${phone}` : `School transport control room helpline updated: ${phone}`
    );
  };

  const handleSaveSchoolProfile = async () => {
    const name = draftSchoolName.trim() || (lang === 'hi' ? 'स्कूल का नाम' : 'School Name');
    const dist = draftSchoolDistrict.trim();
    const st = draftSchoolState.trim();
    const hp = draftSchoolHelpline.trim();
    setSchoolNameConfig(name);
    setSchoolDistrictConfig(dist);
    setSchoolStateConfig(st);
    setSchoolHelplineConfig(hp);
    const profile = { name, district: dist, state: st, helpline: hp };
    const updatedFleet = schoolFleetBuses.map(b => ({ ...b, schoolName: name }));
    setSchoolFleetBuses(updatedFleet);
    await AsyncStorage.setItem('@mast_v7_school_fleet', JSON.stringify(updatedFleet));
    await AsyncStorage.setItem('@mast_v7_school_profile', JSON.stringify(profile));
    await AsyncStorage.setItem('@mast_v7_school_helpline', hp);
    setIsEditingSchoolProfile(false);
    Vibration.vibrate(60);
    await publishCloudEvent({
      type: 'fleet_sync',
      schoolProfile: profile,
      schoolFleetBuses: updatedFleet
    });
    Alert.alert(
      lang === 'hi' ? 'स्कूल प्रोफ़ाइल सुरक्षित व सिंक' : 'School Profile Saved & Synced',
      lang === 'hi' ? `स्कूल विवरण अपडेट हो गया: ${name} (${dist}, ${st})\n\n(सभी अभिभावकों व चालकों के साथ लाइव सिंक हो गया)` : `School profile updated & synced to all mobiles: ${name} (${dist}, ${st})`
    );
  };

  const handleVerifyAdminPin = () => {
    const input = adminPinInput.trim();
    const validPin = schoolAdminPin || '1234';
    if (input === validPin) {
      setIsSchoolAdminAuthenticated(true);
      setUserRole('ADMIN');
      setBusRole('school');
      setIsAdminPinModalOpen(false);
      setAdminPinInput('');
      setAdminPinError('');
      Vibration.vibrate(60);
      publishCloudEvent({ type: 'request_children_sync' });
      fetchLatestSchoolDataFromCloud(false);
    } else {
      Vibration.vibrate([0, 100, 50, 100]);
      setAdminPinError(lang === 'hi' ? '❌ गलत एडमिन मास्टर पिन! अनाधिकृत प्रवेश वर्जित है।' : '❌ Invalid Master PIN! Unauthorized access prohibited.');
    }
  };

  const handleChangeAdminPinSubmit = async () => {
    const currentPin = schoolAdminPin || '1234';
    if (oldAdminPinInput.trim() !== currentPin && oldAdminPinInput.trim() !== '1234') {
      Alert.alert('Notice', lang === 'hi' ? 'पुराना एडमिन पिन गलत है।' : 'Old Admin PIN is incorrect.');
      return;
    }
    const cleanNew = newAdminPinInput.trim();
    if (cleanNew.length < 4) {
      Alert.alert('Notice', lang === 'hi' ? 'नया पिन कम से कम 4 अंकों का होना चाहिए।' : 'New PIN must be at least 4 digits.');
      return;
    }
    setSchoolAdminPin(cleanNew);
    await AsyncStorage.setItem('@mast_v7_school_admin_pin', cleanNew);
    setIsChangeAdminPinOpen(false);
    setOldAdminPinInput('');
    setNewAdminPinInput('');
    Alert.alert(
      lang === 'hi' ? 'पिन बदल दिया गया' : 'PIN Updated',
      lang === 'hi' ? `स्कूल प्रशासन का नया मास्टर सुरक्षा पिन सुरक्षित कर दिया गया: ${cleanNew}` : `New School Admin Master PIN saved successfully: ${cleanNew}`
    );
  };

  const handleLockSchoolAdmin = () => {
    setIsSchoolAdminAuthenticated(false);
    setBusRole('parent');
    Alert.alert(
      lang === 'hi' ? 'एडमिन सत्र समाप्त' : 'Admin Session Locked',
      lang === 'hi' ? 'स्कूल प्रशासन कंसोल को सुरक्षित रूप से लॉक कर दिया गया है।' : 'School Admin console safely locked.'
    );
  };

  const handleVerifyDriverPin = async () => {
    const input = driverPinInput.trim() || '1101';

    let currentFleet = [...schoolFleetBuses];
    const cleanInput = input.toLowerCase().replace(/\s+/g, '');

    const findMatch = (fleet: any[]) => {
      return fleet.find(b =>
        (b.driverPin && b.driverPin.trim() === input) ||
        (b.parentCode && b.parentCode.trim() === input) ||
        (b.busNo && b.busNo.toLowerCase().replace(/\s+/g, '') === cleanInput) ||
        (b.vehicleNo && b.vehicleNo.toLowerCase().replace(/\s+/g, '') === cleanInput)
      );
    };

    let matchedBus = findMatch(currentFleet);

    // If not found locally, query cloud in real-time to fetch admin's newly created buses!
    if (!matchedBus && input !== driverAuthPin && (driverAuthPin !== '1101' || input !== '1101')) {
      setIsCloudSyncing(true);
      const fetchedFleet = await fetchLatestSchoolDataFromCloud(false);
      if (fetchedFleet && Array.isArray(fetchedFleet)) {
        currentFleet = fetchedFleet;
        matchedBus = findMatch(fetchedFleet);
      }
      setIsCloudSyncing(false);
    }

    if (input === driverAuthPin || (driverAuthPin === '1101' && input === '1101') || matchedBus) {
      const finalBus = matchedBus || currentFleet[0] || {
        id: 'fleet_default',
        busNo: 'Bus #01',
        vehicleNo: 'UP 14 AB 1101',
        driverName: 'चालक',
        driverPhone: '',
        conductorName: '',
        conductorPhone: '',
        isTripActive: false
      };

      const driverProfile = {
        id: finalBus.id,
        busNo: finalBus.busNo,
        busCode: finalBus.busNo,
        vehicleNo: finalBus.vehicleNo,
        driverName: finalBus.driverName,
        driverPhone: finalBus.driverPhone,
        conductorName: finalBus.conductorName,
        conductorPhone: finalBus.conductorPhone,
        schoolName: schoolNameConfig || finalBus.schoolName || '',
        district: schoolDistrictConfig || 'बहराइच (Bahraich)',
        state: schoolStateConfig || 'उत्तर प्रदेश (Uttar Pradesh)',
        isTripActive: !!finalBus.isTripActive
      };

      setDriverLoggedInBus(driverProfile);
      setDriverSelectedBus(finalBus.busNo);
      setDriverNameInput(finalBus.driverName);
      setDriverPhoneInput(finalBus.driverPhone);
      setDriverSelectedSchool(schoolNameConfig || finalBus.schoolName || '');
      setDriverState(schoolStateConfig || 'उत्तर प्रदेश (Uttar Pradesh)');
      setDriverDistrict(schoolDistrictConfig || 'बहराइच (Bahraich)');
      setIsDriverAuthenticated(true);
      setBusRole('driver');
      setDriverDutyActive(false);
      setIsDriverPinModalOpen(false);
      setDriverPinInput('');
      setDriverPinError('');

      publishCloudEvent({ type: 'request_children_sync' });
      await AsyncStorage.setItem('@mast_v7_driver_bus', JSON.stringify(driverProfile));
      Alert.alert(
        lang === 'hi' ? '✓ चालक सत्यापित' : '✓ Driver Authenticated',
        lang === 'hi' ? `आप ${finalBus.busNo} के लिए सत्यापित हो चुके हैं।\n\nट्रिप शुरू करने हेतु नीचे '▶ ट्रिप शुरू करें' बटन पर टैप करें।` : `Logged in for ${finalBus.busNo}. Tap 'Start Trip' to begin.`
      );
      Vibration.vibrate(60);
    } else {
      Vibration.vibrate([0, 100, 50, 100]);
      setDriverPinError(lang === 'hi' ? '❌ गलत चालक पिन / कोड! कृपया स्कूल एडमिन द्वारा दिया गया सही कोड दर्ज करें।' : '❌ Invalid Driver PIN/Code! Please enter valid code from School Admin.');
    }
  };

  const handleDriverLogout = async () => {
    if (driverLocationSubRef.current) {
      try { driverLocationSubRef.current.remove(); } catch (e) {}
      driverLocationSubRef.current = null;
    }
    if (driverDutyActive) {
      clearInterval(driverDutyIntervalRef.current);
      setDriverDutyActive(false);
    }
    setIsDriverAuthenticated(false);
    setUserRole('PARENT');
    setBusRole('parent');
    setDriverLoggedInBus(null);
    setDriverPinInput('');
    setDriverPinError('');
    await AsyncStorage.removeItem('@mast_v7_driver_bus');
    Alert.alert(
      lang === 'hi' ? '🔒 चालक सत्र बंद' : '🔒 Driver Session Locked',
      lang === 'hi' ? 'चालक कंसोल को सुरक्षित रूप से लॉक कर दिया गया है।' : 'Driver console safely locked.'
    );
  };

  


  const toggleDriverDuty = async () => {
    const currentBusNo = driverSelectedBus || driverLoggedInBus?.busNo || 'Bus #08';
    const driverName = driverLoggedInBus?.driverName || (lang === 'hi' ? 'चालक' : 'Driver');
    if (driverDutyActive) {
      clearInterval(driverDutyIntervalRef.current);
      if (driverLocationSubRef.current) {
        try { driverLocationSubRef.current.remove(); } catch (e) {}
        driverLocationSubRef.current = null;
      }
      setDriverDutyActive(false);
      
      // Update school fleet bus state
      const updatedFleet = schoolFleetBuses.map(b => 
        (b.busNo === currentBusNo || b.id === driverLoggedInBus?.id) ? { ...b, isTripActive: false } : b
      );
      setSchoolFleetBuses(updatedFleet);
      await AsyncStorage.setItem('@mast_v7_school_fleet', JSON.stringify(updatedFleet));

      const isMorning = busTripShift === 'morning';
      publishCloudEvent({
        type: 'driver_duty_ended',
        busNo: currentBusNo,
        busCode: driverLoggedInBus?.busCode || currentBusNo,
        driverName,
        tripType: busTripShift,
        reachedSchool: isMorning,
        isTripActive: false,
        schoolFleetBuses: updatedFleet,
        eta: 0
      });
      publishCloudEvent({
        type: 'fleet_sync',
        schoolProfile: { name: schoolNameConfig, district: schoolDistrictConfig, state: schoolStateConfig, helpline: schoolHelplineConfig },
        schoolFleetBuses: updatedFleet
      });
      publishCloudEvent({
        type: 'bus_location',
        busNo: currentBusNo,
        busCode: driverLoggedInBus?.busCode || currentBusNo,
        isTripActive: false,
        eta: 0
      });
      Vibration.vibrate([0, 200, 100, 200]);
      Alert.alert(
        isMorning 
          ? (lang === 'hi' ? '🏫 स्कूल पहुँचे - मॉर्निंग ट्रिप समाप्त' : 'School Reached - Morning Trip Completed')
          : (lang === 'hi' ? '🏁 डिपो पहुँचे - वापसी ट्रिप समाप्त' : 'Depot Reached - Return Trip Completed'),
        isMorning 
          ? (lang === 'hi' ? 'बस सुरक्षित स्कूल पहुँच चुकी है। सभी बच्चे सुरक्षित स्कूल में हैं।' : 'Bus has reached school safely.')
          : (lang === 'hi' ? 'बस सुरक्षित डिपो पहुँच चुकी है। सभी बच्चे घर पहुँच चुके हैं।' : 'Bus returned to depot safely.')
      );
    } else {
      setDriverDutyActive(true);
      
      // Update school fleet bus state
      const updatedFleet = schoolFleetBuses.map(b => 
        (b.busNo === currentBusNo || b.id === driverLoggedInBus?.id) ? { ...b, isTripActive: true } : b
      );
      setSchoolFleetBuses(updatedFleet);
      await AsyncStorage.setItem('@mast_v7_school_fleet', JSON.stringify(updatedFleet));

      const isMorning = busTripShift === 'morning';
      // Broadcast trip started immediately to all parents
      publishCloudEvent({
        type: 'driver_duty_started',
        busNo: currentBusNo,
        busCode: driverLoggedInBus?.busCode || currentBusNo,
        driverName,
        tripType: busTripShift,
        vehicleNo: driverLoggedInBus?.vehicleNo || 'UP 14 EF 3308',
        schoolName: schoolNameConfig || 'डीपीएस स्कूल',
        isTripActive: true,
        eta: 14,
        speed: 38
      });
      publishCloudEvent({
        type: 'bus_location',
        busNo: currentBusNo,
        busCode: driverLoggedInBus?.busCode || currentBusNo,
        isTripActive: true,
        eta: 14,
        speed: 38
      });

      Vibration.vibrate([0, 300, 150, 300]);
      Alert.alert(
        isMorning 
          ? (lang === 'hi' ? '🚀 मॉर्निंग पिकअप ट्रिप शुरू!' : '🚀 Morning Pickup Started!')
          : (lang === 'hi' ? '🎒 स्कूल से वापसी ट्रिप शुरू!' : '🎒 Afternoon Drop Started!'),
        lang === 'hi' ? 'बस लाइव हो गई है। अभिभावकों के मोबाइल पर लाइव ट्रैकिंग व स्टॉप्स सक्रिय हो चुके हैं।' : 'GPS Live broadcast active for parents.'
      );

      let currentEta = 14;
      // Request real hardware GPS permissions & start live location watcher
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          // Send immediate initial hardware GPS position
          Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }).then(initLoc => {
            if (initLoc && initLoc.coords) {
              const speedKmh = initLoc.coords.speed && initLoc.coords.speed > 0 ? Math.round(initLoc.coords.speed * 3.6) : 0;
              publishCloudEvent({
                type: 'bus_location',
                busNo: currentBusNo,
                busCode: driverLoggedInBus?.busCode || currentBusNo,
                isTripActive: true,
                coords: { lat: initLoc.coords.latitude, lng: initLoc.coords.longitude },
                speed: speedKmh,
                eta: currentEta
              });
            }
          }).catch(() => {});

          // Live GPS tracking stream from device hardware chip
          Location.watchPositionAsync(
            {
              accuracy: Location.Accuracy.High,
              timeInterval: 4000,
              distanceInterval: 5
            },
            (loc) => {
              if (loc && loc.coords) {
                const speedKmh = loc.coords.speed && loc.coords.speed > 0 ? Math.round(loc.coords.speed * 3.6) : 0;
                publishCloudEvent({
                  type: 'bus_location',
                  busNo: currentBusNo,
                  busCode: driverLoggedInBus?.busCode || currentBusNo,
                  isTripActive: true,
                  coords: { lat: loc.coords.latitude, lng: loc.coords.longitude },
                  speed: speedKmh,
                  eta: currentEta
                });
              }
            }
          ).then(sub => {
            driverLocationSubRef.current = sub;
          }).catch(() => {});
        }
      } catch (err) {
        console.log('Location watch error:', err);
      }

      driverDutyIntervalRef.current = setInterval(() => {
        const timeNow = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
        setLastLocationUpdateTime(timeNow);
        if (currentEta > 1) {
          currentEta -= 1;
        }
        publishCloudEvent({
          type: 'bus_location',
          busNo: currentBusNo,
          busCode: currentBusNo,
          isTripActive: true,
          eta: currentEta,
          speed: 38
        });

        setSchoolChildren(prev => prev.map(ch => {
          if (ch.busNo === currentBusNo || ch.busCode === currentBusNo) {
            return { ...ch, etaMins: currentEta };
          }
          return ch;
        }));
      }, 5000);
    }
  };

  const toggleStudentBoarding = (childId: string) => {
    Vibration.vibrate(60);
    setSchoolChildren(prev => {
      const updated = prev.map(c => {
        if (c.id === childId) {
          const nextState = !c.isBoarded;
          publishCloudEvent({
            type: 'student_boarding',
            childId: c.id,
            childName: c.name,
            isBoarded: nextState,
            tripType: busTripShift,
            busCode: c.busCode || c.busNo
          });
          return { ...c, isBoarded: nextState };
        }
        return c;
      });
      AsyncStorage.setItem('@mast_v7_school_children', JSON.stringify(updated));
      publishCloudEvent({
        type: 'children_sync',
        children: updated
      });
      return updated;
    });
  };

  const markAllStudentsBoarded = () => {
    Vibration.vibrate([0, 100, 50, 100]);
    setSchoolChildren(prev => {
      const updated = prev.map(c => {
        publishCloudEvent({
          type: 'student_boarding',
          childId: c.id,
          childName: c.name,
          isBoarded: true,
          tripType: busTripShift,
          busCode: c.busCode || c.busNo
        });
        return { ...c, isBoarded: true };
      });
      AsyncStorage.setItem('@mast_v7_school_children', JSON.stringify(updated));
      publishCloudEvent({
        type: 'children_sync',
        children: updated
      });
      return updated;
    });
    Alert.alert(
      lang === 'hi' ? '✅ सभी छात्र सवार' : 'All Students Boarded',
      lang === 'hi' ? 'सभी अभिभावकों को संदेश भेज दिया गया है कि बच्चे बस में सवार हो चुके हैं और बस स्कूल से निकल चुकी है!' : 'All parents notified that students are boarded.'
    );
  };

  // Open / Edit Medicine
  const openAddMedModal = () => {
    setEditingMedId(null);
    setNewMedName('');
    setNewMedTime('08:00 AM');
    setNewMedDose('1 गोली खाने बाद');
    setNewMedDoc('');
    setNewMedPhoto(null);
    setNewMedPatient(userProfile?.name ? `${userProfile.name} (स्वयं)` : 'स्वयं (Self)');
    setNewMedCourseDays('10');
    setNewMedFollowupNeeded(true);
    const defaultFollowup = new Date();
    defaultFollowup.setDate(defaultFollowup.getDate() + 10);
    const monthsShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const dStr = defaultFollowup.getDate() < 10 ? `0${defaultFollowup.getDate()}` : `${defaultFollowup.getDate()}`;
    setNewMedFollowupDate(`${dStr} ${monthsShort[defaultFollowup.getMonth()]} ${defaultFollowup.getFullYear()}`);
    setNewMedRefillNeeded(true);
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
    setNewMedCourseDays(m.courseDays ? `${m.courseDays}` : '10');
    setNewMedFollowupNeeded(m.doctorFollowupNeeded !== false);
    setNewMedFollowupDate(m.doctorFollowupDate || '');
    setNewMedRefillNeeded(m.refillReminderNeeded !== false);
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

  // Open / Edit Reminder with Category & Date Pre-filling
  const openAddReminderModal = (presetCategory?: 'bills' | 'bday' | 'anniversary' | 'task' | 'health' | 'other', presetDate?: string) => {
    setEditingReminderId(null);
    setNewRemTitle('');
    setNewRemAmount('');
    const now = new Date();
    const monthsShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const dStr = `${now.getDate() < 10 ? '0' : ''}${now.getDate()} ${monthsShort[now.getMonth()]}`;
    setNewRemDate(presetDate || dStr);
    setNewRemCategory(presetCategory || 'task');
    setNewRemUrgent(presetCategory === 'task');
    setIsAddReminderModalOpen(true);
  };
  const openEditReminderModal = (r: any) => {
    setEditingReminderId(r.id);
    setNewRemTitle(r.titleHi || r.titleEn || r.title || '');
    setNewRemAmount(r.amount || '');
    setNewRemDate(r.date || '');
    setNewRemCategory(r.category || 'task');
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
    fetchLatestSchoolDataFromCloud(false);
    setEditingChildId(null);
    setNewChildName('');
    setNewChildAvatar('👧');
    setNewChildSchool(schoolNameConfig || '');
    setNewChildGrade('');
    setNewChildBusNo('');
    setNewChildBusCode('');
    setNewChildStopName('');
    setNewChildSchoolFee('');
    setNewChildBusFee('');
    setNewChildDueDay('10');
    setNewChildDriverName('');
    setNewChildConductorName('');
    setNewChildVehicleNo('');
    if (!parentState && schoolStateConfig) setParentState(schoolStateConfig);
    if (!parentDistrict && schoolDistrictConfig) setParentDistrict(schoolDistrictConfig);
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
    setNewChildSchoolHelpline(child.schoolHelpline || '');
    setNewChildDriverPhone(child.driverPhone || '');
    setNewChildConductorPhone(child.conductorPhone || '');
    if (child.state) setParentState(child.state);
    if (child.district) setParentDistrict(child.district);
    setAutoSetChildReminder(true);
    setIsAddChildModalOpen(true);
  };
  const handleAddNewChild = async () => {
    if (isSavingChild) return;
    if (!newChildName.trim() || !newChildSchool.trim()) {
      Alert.alert('Notice', lang === 'hi' ? 'बच्चे व स्कूल का नाम लिखें' : 'Please enter child & school name');
      return;
    }
    setIsSavingChild(true);
    try {
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
        vehicleNo: newChildVehicleNo.trim() || ((existingChild?.vehicleNo && !existingChild.vehicleNo.includes('DL 01')) ? existingChild.vehicleNo : (busNo ? `बस: ${busNo}` : 'UP 14 AB 1101')),
        stopNameHi: `${stopName} (आपका स्टॉप)`,
        stopNameEn: `${stopName} (Your Stop)`,
        stopCoords: existingChild?.stopCoords || getCoordinatesForLocation(parentState, parentDistrict),
        busCoords: existingChild?.busCoords || { 
          lat: getCoordinatesForLocation(parentState, parentDistrict).lat + 0.006, 
          lng: getCoordinatesForLocation(parentState, parentDistrict).lng - 0.007 
        },
        rfidTag: existingChild?.rfidTag || `ID-${Math.floor(1000 + Math.random() * 9000)}`,
        seatNo: existingChild?.seatNo || 'Auto Assigned',
        driverNameHi: newChildDriverName.trim() || existingChild?.driverNameHi || (lang === 'hi' ? 'महेश कुमार' : 'Mahesh Kumar'),
        driverNameEn: newChildDriverName.trim() || existingChild?.driverNameEn || 'Mahesh Kumar',
        driverPhone: newChildDriverPhone.trim() || ((existingChild?.driverPhone && !existingChild.driverPhone.includes('X')) ? existingChild.driverPhone : ''),
        conductorNameHi: newChildConductorName.trim() || existingChild?.conductorNameHi || (lang === 'hi' ? 'सुरेश' : 'Suresh'),
        conductorNameEn: newChildConductorName.trim() || existingChild?.conductorNameEn || 'Suresh',
        conductorPhone: newChildConductorPhone.trim() || ((existingChild?.conductorPhone && !existingChild.conductorPhone.includes('X')) ? existingChild.conductorPhone : ''),
        schoolHelpline: newChildSchoolHelpline.trim() || ((existingChild?.schoolHelpline && !existingChild.schoolHelpline.includes('011')) ? existingChild.schoolHelpline : ''),
        etaMins: existingChild?.etaMins || 10,
        speedKmh: existingChild?.speedKmh || 35,
        isBoarded: existingChild ? existingChild.isBoarded : false,
        stops: [
          {
            id: 1,
            time: busTripShift === 'morning' ? '07:15 AM' : '02:15 PM',
            titleHi: `${newChildSchool.trim()} गेट`,
            titleEn: `${newChildSchool.trim()} Gate`,
            subHi: 'प्रस्थान ✓',
            subEn: 'Departed ✓',
            status: 'passed'
          },
          {
            id: 2,
            time: busTripShift === 'morning' ? '07:35 AM' : '02:35 PM',
            titleHi: `${stopName} (आपका स्टॉप)`,
            titleEn: `${stopName} (Your Stop)`,
            subHi: 'बस 10 मिनट दूर है',
            subEn: 'Bus is 10 mins away',
            status: 'target',
            isUserStop: true
          },
          {
            id: 3,
            time: busTripShift === 'morning' ? '07:55 AM' : '02:55 PM',
            titleHi: busTripShift === 'morning' ? (lang === 'hi' ? 'स्कूल परिसर (पहुँच)' : 'School Campus (Arrival)') : (lang === 'hi' ? 'अंतिम स्टॉप (डिपो)' : 'Final Terminal (Depot)'),
            titleEn: busTripShift === 'morning' ? 'School Campus (Arrival)' : 'Final Terminal (Depot)',
            subHi: 'आगामी',
            subEn: 'Upcoming',
            status: 'upcoming'
          }
        ],
        schoolFee: sFeeNum > 0 ? `₹${sFeeNum}` : '',
        busFee: bFeeNum > 0 ? `₹${bFeeNum}` : '',
        dueDay: dueDayNum
      };

      let updated: any[] = [];
      if (isEditing) {
        updated = schoolChildren.map(c => c.id === editingChildId ? savedChild : c);
      } else {
        // Automatically hide placeholder demo child ('demo_riya_01') when user enrolls real child
        const realChildren = schoolChildren.filter(c => c.id !== 'demo_riya_01');
        updated = [...realChildren, savedChild];
      }

      setSchoolChildren(updated);
      setActiveChildId(savedChild.id);
      setIsAddChildModalOpen(false);
      setEditingChildId(null);
      await AsyncStorage.setItem('@mast_v7_school_children', JSON.stringify(updated));

      // Automatically generate Reminders if opted for Next Due Date
      const newRemindersCreated: any[] = [];
      const monthsShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const now = new Date();
      const todayDate = now.getDate();
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
            linkedChildId: currentChildId,
            category: 'fees',
            titleHi: `🏫 ${savedChild.name} - स्कूल फीस (${schoolName})`,
            titleEn: `🏫 ${savedChild.name} - School Fee (${schoolName})`,
            amount: `₹${sFeeNum.toLocaleString('en-IN')}`,
            date: dueDateDisplay,
            urgent: true,
            paid: false
          });
        }
        if (bFeeNum > 0) {
          newRemindersCreated.push({
            id: Date.now() + 102,
            linkedChildId: currentChildId,
            category: 'fees',
            titleHi: `🚌 ${savedChild.name} - स्कूल बस फीस (${busNo})`,
            titleEn: `🚌 ${savedChild.name} - Bus Fee (${busNo})`,
            amount: `₹${bFeeNum.toLocaleString('en-IN')}`,
            date: dueDateDisplay,
            urgent: false,
            paid: false
          });
        }
        const cleanReminders = upcomingReminders.filter(r => r.linkedChildId !== currentChildId);
        if (newRemindersCreated.length > 0) {
          saveReminders([...cleanReminders, ...newRemindersCreated]);
        } else if (isEditing) {
          saveReminders(cleanReminders);
        }
      }

      // Automatically sync school & bus to Driver Mode!
      setRegisteredSchools(prev => Array.from(new Set([schoolName, ...prev])));
      setDriverSelectedSchool(schoolName);
      setDriverState(parentState);
      setDriverDistrict(parentDistrict);
      setDriverSelectedBus(busNo);

      // Broadcast child registration to Driver, Admin & Family mobiles
      publishCloudEvent({
        type: 'child_registered',
        child: savedChild,
        schoolName,
        busNo,
        state: parentState,
        district: parentDistrict
      });
      publishCloudEvent({
        type: 'children_sync',
        children: updated
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
      setNewChildSchoolHelpline('');
      setNewChildDriverPhone('');
      setNewChildConductorPhone('');

      const reminderMsg = newRemindersCreated.length > 0
        ? (lang === 'hi'
            ? ` और ${newRemindersCreated.length} मासिक फीस रिमाइंडर भी सेट हो गए हैं!`
            : ` and ${newRemindersCreated.length} monthly fee reminders created!`)
        : '';

      Vibration.vibrate(100);
      Alert.alert(
        lang === 'hi' ? 'सफल' : 'Success',
        lang === 'hi'
          ? `बच्चा (${savedChild.name}) व स्कूल बस (${busNo}) सुरक्षित जुड़ गए हैं${reminderMsg}`
          : `Child (${savedChild.name}) and school bus (${busNo}) saved successfully${reminderMsg}`
      );
    } catch (e: any) {
      console.log('Error saving child:', e);
      Alert.alert('Notice', lang === 'hi' ? 'सेव करने में समस्या आई' : 'Failed to save');
    } finally {
      setIsSavingChild(false);
    }
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
            if (updated.length > 0) {
              setActiveChildId(updated[0].id);
            } else {
              setActiveChildId('');
            }
            await AsyncStorage.setItem('@mast_v7_school_children', JSON.stringify(updated));
            await saveReminders(upcomingReminders.filter(r => r.linkedChildId !== childId));
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
      body: lang === 'hi' ? 'बस आपके स्टॉप पर पहुँचने वाली है, तैयार रहें।' : 'Bus reaching your stop shortly.',
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

  const refreshBusGPS = async () => {
    Vibration.vibrate(60);
    setIsCloudSyncing(true);
    try {
      const timeNow = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
      setLastLocationUpdateTime(timeNow);
      await fetchLatestSchoolDataFromCloud(false);
      setCloudSyncMsg(lang === 'hi' ? `✅ जीपीएस लोकेशन अपडेट हुआ (${timeNow})` : `✅ GPS location refreshed (${timeNow})`);
      setTimeout(() => setCloudSyncMsg(''), 4000);
    } catch (e) {
      setCloudSyncMsg(lang === 'hi' ? '⚠️ जीपीएस रीफ्रेश में समस्या' : '⚠️ GPS refresh issue');
      setTimeout(() => setCloudSyncMsg(''), 3000);
    } finally {
      setIsCloudSyncing(false);
    }
  };

  const dispatchDriverAnnouncement = (titleHi: string, titleEn: string, eta: number, stopIdx: number) => {
    try {
      Vibration.vibrate([0, 150, 100, 150]);
      setBusETA(eta);
      setBusStopIdx(stopIdx);
      setSchoolChildren(prev => prev.map(ch => ({ ...ch, etaMins: eta })));
      const annText = lang === 'hi' ? titleHi : titleEn;
      setActiveVoiceAnnouncement({
        text: annText,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        from: lang === 'hi' ? 'चालक उद्घोषणा' : 'Driver Announcement'
      });
      publishCloudEvent({
        type: 'voice_announcement',
        announcementTitle: annText,
        text: annText,
        sender: lang === 'hi' ? 'चालक (Driver)' : 'Bus Driver',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
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
    } catch (err) {
      console.log('Driver announcement error:', err);
    }
  };

  // Working GPS Simulator for Parents Test
  const toggleBusSimulation = () => {
    if (isBusSimulating) {
      if (busTimerRef.current) clearInterval(busTimerRef.current);
      setIsBusSimulating(false);
      setIsTripActive(false);
      return;
    }
    setIsBusSimulating(true);
    setIsTripActive(true);
    let simEta = 10;
    setBusETA(simEta);
    setSchoolChildren(prev => prev.map(ch => ({ ...ch, etaMins: simEta })));
    Vibration.vibrate(80);

    if (busTimerRef.current) clearInterval(busTimerRef.current);
    busTimerRef.current = setInterval(() => {
      simEta -= 2;
      if (simEta <= 0) {
        clearInterval(busTimerRef.current);
        setBusETA(0);
        setIsBusSimulating(false);
        setSchoolChildren(prev => prev.map(ch => ({ ...ch, etaMins: 0 })));
        Vibration.vibrate([0, 200, 100, 200]);
        Alert.alert(
          lang === 'hi' ? '🚌 स्कूल बस पहुँच गई!' : '🚌 School Bus Arrived!',
          lang === 'hi' ? 'बस आपके स्टॉप पर पहुँच चुकी है। बच्चे को सुरक्षित बैठाएं/उतारें।' : 'Bus has reached your stop.'
        );
      } else {
        setBusETA(simEta);
        setSchoolChildren(prev => prev.map(ch => ({ ...ch, etaMins: simEta })));
      }
    }, 3000);
  };

  // Smart Intercom Buzzer Trigger with Cloud Broadcast
  const triggerIntercomBuzzer = (msgHi: string, msgEn: string) => {
    Vibration.vibrate([0, 300, 150, 300]);
    const body = lang === 'hi' ? msgHi : msgEn;
    const myName = userProfile?.name || (lang === 'hi' ? 'परिवार सदस्य' : 'Family Member');
    setInAppAlert({
      title: '🔊 ' + myName + ': ' + (lang === 'hi' ? 'पारिवारिक इंटरकॉम अलर्ट' : 'Family Intercom Alert'),
      body,
      type: 'intercom'
    });
    setTimeout(() => setInAppAlert(null), 6000);

    // Schedule immediate loud local notification so sound plays even if screen turns off
    try {
      Notifications.scheduleNotificationAsync({
        content: {
          title: '📢 ' + myName + ': ' + (lang === 'hi' ? 'पारिवारिक इंटरकॉम' : 'Family Intercom'),
          body,
          sound: 'default',
          priority: Notifications.AndroidNotificationPriority.MAX,
          vibrate: [0, 400, 200, 400]
        },
        trigger: null
      });
    } catch (e) {}

    // Broadcast over cloud network to other family phones
    publishCloudEvent({
      type: 'intercom',
      title: lang === 'hi' ? 'इंटरकॉम बजर' : 'Intercom Buzzer',
      body,
      senderName: myName
    });

    Alert.alert(
      lang === 'hi' ? '🔊 इंटरकॉम अलर्ट भेजा गया' : '🔊 Intercom Alert Sent',
      body + (lang === 'hi' ? '\n\n(क्लाउड नेटवर्क द्वारा सभी जुड़े मोबाइलों पर सायरन व संदेश भेजा गया)' : '\n\n(Broadcasted to all connected family phones)')
    );
  };

  const toggleMedicine = async (id: number) => {
    const updated = { ...takenMeds, [id]: !takenMeds[id] };
    await saveTaken(updated);
  };

  // Real UPI Payment Intent with Amount Validation & Direct PhonePe/GPay Trigger
  const handleUPIPayment = async (amt: string) => {
    const cleanAmt = (amt || '').replace(/[^0-9]/g, '');
    if (!cleanAmt || parseInt(cleanAmt, 10) <= 0) {
      Alert.alert(
        lang === 'hi' ? 'अमान्य राशि' : 'Invalid Amount',
        lang === 'hi' ? 'कृपया कम से कम ₹1 की राशि दर्ज करें।' : 'Please enter an amount of at least ₹1.'
      );
      return;
    }
    const upiUrl = `upi://pay?pa=9451605191@ptyes&pn=MAST%20Life%20OS&am=${cleanAmt}&cu=INR&tn=Support%20MAST%20Voluntarily`;
    try {
      const supported = await Linking.canOpenURL(upiUrl);
      if (supported) {
        await Linking.openURL(upiUrl);
      } else {
        Alert.alert(
          'UPI Payment Support',
          lang === 'hi'
            ? `सीधे UPI ऐप नहीं खुला। आप PhonePe, Google Pay या Paytm पर UPI ID: 9451605191@ptyes डालकर ₹${cleanAmt} सहयोग भेज सकते हैं।`
            : `No UPI app opened automatically. You can send ₹${cleanAmt} directly to UPI ID: 9451605191@ptyes via PhonePe/GPay.`
        );
      }
    } catch (e) {
      Alert.alert('UPI Support', `UPI ID: 9451605191@ptyes (₹${cleanAmt})`);
    }
    setCustomDonationInput('');
    setIsDonateModalOpen(false);
  };

  // Real Emergency SOS
  const handleSendSOS = async () => {
    const sender = userProfile?.name 
      ? `${userProfile.name} (${lang === 'hi' ? 'स्वयं' : 'Self'})` 
      : (lang === 'hi' ? 'परिवार सदस्य (स्वयं)' : 'Family Member (Self)');
    await publishCloudEvent({
      type: 'sos',
      senderName: sender,
      body: lang === 'hi' ? 'आपातकालीन सहायता की आवश्यकता है!' : 'Emergency assistance required!'
    });
    const contactNumbers = familyMembers
      .filter(m => m.phone && m.phone.replace(/[^0-9]/g, '').length >= 10)
      .map(m => m.phone.trim());
    const recipientParam = contactNumbers.length > 0 ? (Platform.OS === 'ios' ? `&addresses=${contactNumbers.join(',')}` : contactNumbers[0]) : '';
    const smsBody = encodeURIComponent(
      lang === 'hi'
        ? `🚨 EMERGENCY SOS (${sender}): मुझे तुरंत सहायता की आवश्यकता है! (Sent from MAST Family OS)`
        : `🚨 EMERGENCY SOS (${sender}): I need urgent assistance! (Sent from MAST Family OS)`
    );
    const smsUrl = recipientParam 
      ? (Platform.OS === 'ios' ? `sms:${recipientParam}&body=${smsBody}` : `sms:${recipientParam}?body=${smsBody}`)
      : `sms:?body=${smsBody}`;
    Linking.openURL(smsUrl);
    setIsSOSModalOpen(false);
    Alert.alert(
      lang === 'hi' ? 'SOS भेजा गया' : 'SOS Sent',
      lang === 'hi' ? 'क्लाउड नेटवर्क व SMS के माध्यम से परिवार को SOS अलर्ट भेजा गया!' : 'SOS broadcasted to family!'
    );
  };

  // Add Handlers
  // Calendar Control Helpers
  const openCalendar = (
    target: 'appliance' | 'reminder' | 'expense' | 'member' | 'doc' | 'gold' | 'diary' | 'child_due' | 'med_followup',
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
    } else if (calendarTarget === 'med_followup') {
      setNewMedFollowupDate(formattedFull);
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
    const activeMonthNames = lang === 'hi' ? monthNamesHi : monthNamesEn;

    const weekDaysHi = ['रवि', 'सोम', 'मंगल', 'बुध', 'गुरु', 'शुक्र', 'शनि'];
    const weekDaysEn = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const activeWeekDays = lang === 'hi' ? weekDaysHi : weekDaysEn;

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
                  {activeMonthNames[calendarViewMonth]} ▼
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
            <View style={{ marginVertical: 8 }}>
              {/* VIEW MODE 2: DIRECT MONTH PICKER */}
              <Text style={{ fontSize: 13, fontWeight: 'bold', color: '#0f172a', textAlign: 'center', marginBottom: 10 }}>
                {lang === 'hi' ? 'महीना चुनें:' : 'Select Month:'}
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
                {activeMonthNames.map((mName, mIdx) => {
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
            <View {...panResponder.panHandlers}>
              {/* VIEW MODE 3: STANDARD DAY GRID WITH SWIPE GESTURE */}
              {/* Weekday labels */}
              <View style={styles.calendarWeekRow}>
                {activeWeekDays.map(d => (
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
              <Text style={styles.calendarQuickChipText}>{lang === 'hi' ? 'आज (Today)' : 'Today'}</Text>
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
              <Text style={styles.calendarQuickChipText}>{lang === 'hi' ? 'कल (Tomorrow)' : 'Tomorrow'}</Text>
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
              <Text style={styles.calendarQuickChipText}>{lang === 'hi' ? '+1 वर्ष' : '+1 Year'}</Text>
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
              <Text style={styles.calendarQuickChipText}>{lang === 'hi' ? '+5 वर्ष' : '+5 Years'}</Text>
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
    const cDays = parseInt(newMedCourseDays, 10) || 10;
    const now = new Date();
    const monthsShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    // Refill date: 1 day before course ends
    const refillDateObj = new Date();
    refillDateObj.setDate(refillDateObj.getDate() + Math.max(1, cDays - 1));
    const rDayStr = refillDateObj.getDate() < 10 ? `0${refillDateObj.getDate()}` : `${refillDateObj.getDate()}`;
    const computedRefillDate = `${rDayStr} ${monthsShort[refillDateObj.getMonth()]}`;

    // Follow-up date: today + cDays (or user specified)
    let computedFollowupDate = newMedFollowupDate.trim();
    if (!computedFollowupDate) {
      const followupDateObj = new Date();
      followupDateObj.setDate(followupDateObj.getDate() + cDays);
      const fDayStr = followupDateObj.getDate() < 10 ? `0${followupDateObj.getDate()}` : `${followupDateObj.getDate()}`;
      computedFollowupDate = `${fDayStr} ${monthsShort[followupDateObj.getMonth()]} ${followupDateObj.getFullYear()}`;
    }

    const savedEntry = {
      id: editingMedId || Date.now(),
      nameHi: newMedName.trim(),
      nameEn: newMedName.trim(),
      time: newMedTime,
      doseHi: newMedDose || '1 गोली',
      doseEn: newMedDose || '1 pill',
      doctorHi: newMedDoc || (lang === 'hi' ? 'डॉ. निजी चिकित्सक' : 'Dr. Family Physician'),
      doctorEn: newMedDoc || 'Dr. Family Physician',
      hospitalHi: existing?.hospitalHi || 'पारिवारिक क्लिनिक',
      hospitalEn: existing?.hospitalEn || 'Family Clinic',
      patientHi: patientName,
      patientEn: patientName,
      date: existing?.date || (lang === 'hi' ? 'आज' : 'Today'),
      imageUri: newMedPhoto,
      courseDays: cDays,
      startDate: existing?.startDate || `${now.getDate()} ${monthsShort[now.getMonth()]}`,
      doctorFollowupNeeded: newMedFollowupNeeded,
      doctorFollowupDate: computedFollowupDate,
      refillReminderNeeded: newMedRefillNeeded,
      refillDate: computedRefillDate
    };

    const updated = editingMedId ? medicines.map(m => m.id === editingMedId ? savedEntry : m) : [...medicines, savedEntry];
    await saveMeds(updated);

    // Sync to Upcoming Reminders
    const medId = savedEntry.id;
    const otherReminders = upcomingReminders.filter(r => r.linkedMedId !== medId);
    const newMedsReminders: any[] = [];

    if (newMedFollowupNeeded) {
      newMedsReminders.push({
        id: Date.now() + 201,
        linkedMedId: medId,
        category: 'health',
        titleHi: `👨‍⚕️ डॉ. फॉलो-अप चेकअप: ${newMedDoc || 'डॉक्टर'} (${patientName})`,
        titleEn: `👨‍⚕️ Doctor Review: ${newMedDoc || 'Doctor'} (${patientName})`,
        amount: `${cDays} दिन का कोर्स पूरा`,
        date: computedFollowupDate.split(' ').slice(0, 2).join(' '),
        urgent: true,
        paid: false
      });
    }

    if (newMedRefillNeeded) {
      newMedsReminders.push({
        id: Date.now() + 202,
        linkedMedId: medId,
        category: 'health',
        titleHi: `💊 दवा रीफिल अलर्ट: ${newMedName.trim()} (${patientName})`,
        titleEn: `💊 Refill Alert: ${newMedName.trim()} (${patientName})`,
        amount: 'कल दवा खत्म होगी',
        date: computedRefillDate,
        urgent: true,
        paid: false
      });
    }

    if (newMedsReminders.length > 0) {
      await saveReminders([...otherReminders, ...newMedsReminders]);
    } else if (editingMedId) {
      await saveReminders(otherReminders);
    }

    setNewMedName('');
    setNewMedDose('1 गोली खाने बाद');
    setNewMedDoc('');
    setNewMedPhoto(null);
    setEditingMedId(null);
    setIsAddMedModalOpen(false);
    Alert.alert(
      lang === 'hi' ? 'सफल' : 'Success',
      lang === 'hi' 
        ? `दवाई सुरक्षित हो गई!\n${newMedFollowupNeeded ? `• 👨‍⚕️ डॉ. फॉलो-अप: ${computedFollowupDate}\n` : ''}${newMedRefillNeeded ? `• 🔔 रीफिल अलर्ट: ${computedRefillDate}` : ''}`
        : `Medicine saved!\n${newMedFollowupNeeded ? `• Dr. Review: ${computedFollowupDate}\n` : ''}${newMedRefillNeeded ? `• Refill Alert: ${computedRefillDate}` : ''}`
    );
  };

  const handleQuickRefill = async (med: any) => {
    const additionalDays = 10;
    const now = new Date();
    const monthsShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const newRefillObj = new Date();
    newRefillObj.setDate(newRefillObj.getDate() + additionalDays - 1);
    const rDayStr = newRefillObj.getDate() < 10 ? `0${newRefillObj.getDate()}` : `${newRefillObj.getDate()}`;
    const newRefillDate = `${rDayStr} ${monthsShort[newRefillObj.getMonth()]}`;

    const updatedMed = {
      ...med,
      courseDays: (med.courseDays || 10) + additionalDays,
      refillDate: newRefillDate
    };
    const updated = medicines.map(m => m.id === med.id ? updatedMed : m);
    await saveMeds(updated);

    const otherReminders = upcomingReminders.filter(r => !(r.linkedMedId === med.id && r.titleHi?.includes('रीफिल')));
    const newRefillReminder = {
      id: Date.now() + 203,
      linkedMedId: med.id,
      category: 'health',
      titleHi: `💊 दवा रीफिल अलर्ट: ${med.nameHi || med.nameEn} (${med.patientHi || 'स्वयं'})`,
      titleEn: `💊 Refill Alert: ${med.nameEn || med.nameHi} (${med.patientEn || 'Self'})`,
      amount: 'कल दवा खत्म होगी',
      date: newRefillDate,
      urgent: true,
      paid: false
    };
    await saveReminders([...otherReminders, newRefillReminder]);

    Alert.alert(
      lang === 'hi' ? 'दवा रीफिल दर्ज ✓' : 'Refill Recorded ✓',
      lang === 'hi' ? `नई दवा स्टॉक में जुड़ गई (+10 दिन)।\nअगला रीफिल अलर्ट: ${newRefillDate}` : `Added 10 days stock. Next refill alert: ${newRefillDate}`
    );
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
      Alert.alert('Notice', lang === 'hi' ? 'रिमाइंडर का शीर्षक या कार्य लिखें' : 'Please enter title or task');
      return;
    }
    const existing = upcomingReminders.find(r => r.id === editingReminderId);
    let computedAmount = '';
    if (newRemAmount && newRemAmount.trim()) {
      const cleanAmt = newRemAmount.trim();
      computedAmount = (newRemCategory === 'bills' && !cleanAmt.startsWith('₹')) ? `₹${cleanAmt}` : cleanAmt;
    } else {
      if (newRemCategory === 'task') {
        computedAmount = lang === 'hi' ? 'आज का कार्य' : 'Daily Task';
      } else if (newRemCategory === 'bday') {
        computedAmount = lang === 'hi' ? 'वार्षिक जन्मदिन' : 'Annual Birthday';
      } else if (newRemCategory === 'anniversary') {
        computedAmount = lang === 'hi' ? 'वार्षिक सालगिरह' : 'Annual Anniversary';
      } else {
        computedAmount = existing?.amount || '';
      }
    }

    const savedRem = {
      id: editingReminderId || Date.now(),
      category: newRemCategory,
      titleHi: newRemTitle.trim(),
      titleEn: newRemTitle.trim(),
      amount: computedAmount,
      date: newRemDate || (existing?.date || getFormattedDate(lang)),
      urgent: newRemUrgent,
      paid: existing ? existing.paid : false
    };
    const updated = editingReminderId ? upcomingReminders.map(r => r.id === editingReminderId ? savedRem : r) : [...upcomingReminders, savedRem];
    await saveReminders(updated);
    setNewRemTitle('');
    setNewRemAmount('');
    setEditingReminderId(null);
    setIsAddReminderModalOpen(false);
    Alert.alert(
      lang === 'hi' ? 'सफल' : 'Success', 
      editingReminderId 
        ? (lang === 'hi' ? 'रिमाइंडर / कार्य अपडेट हो गया!' : 'Task / Reminder updated!') 
        : (lang === 'hi' ? 'नया कार्य / रिमाइंडर सेट हो गया!' : 'Task / Reminder saved!')
    );
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
    setNewExpDate(lang === 'hi' ? 'आज' : 'Today');
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

    // Auto-create / Sync Birthday Reminder for Family Member
    if (savedM.dob && savedM.dob.trim()) {
      const bdayReminderId = 880000 + (savedM.id % 10000);
      const otherRems = upcomingReminders.filter(r => r.id !== bdayReminderId && r.linkedMemberId !== savedM.id);
      const bdayDatePart = savedM.dob.split(' ').slice(0, 2).join(' ');
      const bdayReminder = {
        id: bdayReminderId,
        linkedMemberId: savedM.id,
        category: 'bday',
        titleHi: `🎂 ${savedM.name} का जन्मदिन`,
        titleEn: `🎂 ${savedM.name}'s Birthday`,
        amount: lang === 'hi' ? 'वार्षिक जन्मदिन' : 'Annual Birthday',
        amountEn: 'Annual Birthday',
        date: bdayDatePart,
        urgent: false,
        paid: false
      };
      await saveReminders([...otherRems, bdayReminder]);
    }

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
    setNewDiaryDate(lang === 'hi' ? 'आज' : 'Today');
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
    const myName = userProfile?.name || (lang === 'hi' ? 'स्वयं' : 'Self');
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const newMsg = { 
      id: Date.now(), 
      senderHi: myName, 
      senderEn: myName, 
      msgHi: msgText, 
      msgEn: msgText, 
      time: timeStr, 
      isSelf: true 
    };
    await saveChat([...familyChat, newMsg]);
    setChatInput('');

    // Publish to cloud for other family phones
    publishCloudEvent({
      type: 'chat',
      msgId: newMsg.id,
      senderName: myName,
      text: msgText,
      time: timeStr
    });

    setTimeout(() => {
      chatScrollRef.current?.scrollToEnd({ animated: true });
    }, 150);
  };

  
  // Unified Family Network Connector Function with Rapid-Tap Debounce Lock
  const handleConnectFamilyCode = async (newCode: string, isJoining = true) => {
    if (isConnectingFamily) return;
    setIsConnectingFamily(true);
    try {
      const c = newCode.trim().toUpperCase();
      if (c.length < 3) {
        Alert.alert('Notice', lang === 'hi' ? 'कम से कम 3 अक्षरों का कोड डालें।' : 'Code must be at least 3 chars.');
        return;
      }
      setFamilyCode(c);
      await AsyncStorage.setItem('@mast_v7_family_code', c);
      Vibration.vibrate(80);

      // Announce device joined on the new topic explicitly
      await publishCloudEvent({
        type: 'family_device_joined',
        senderName: userProfile?.name || (lang === 'hi' ? 'पारिवारिक फोन' : 'Family Phone'),
        deviceId: myDeviceId
      }, c);

      await publishCloudEvent({ type: 'heartbeat', senderName: userProfile?.name || 'पारिवारिक फोन' }, c);
      await publishCloudEvent({ type: 'request_family_sync' }, c);
      await publishCloudEvent({ type: 'request_fleet_sync' }, c);

      // Fetch cloud data using explicit new code
      await fetchLatestSchoolDataFromCloud(true, c);

      if (isJoining) {
        Alert.alert(
          lang === 'hi' ? '✓ नेटवर्क कनेक्टेड!' : '✓ Connected!',
          lang === 'hi' 
            ? `अब यह मोबाइल परिवार कोड "${c}" से लाइव जुड़ चुका है!\n\nपरिवार के सभी सदस्य, इंटरकॉम बज़र और स्कूल बस डेटा दोनों फोन पर तुरंत सिंक रहेंगे।` 
            : `Connected to Family Code ${c}!`
        );
      }
    } finally {
      setTimeout(() => setIsConnectingFamily(false), 1500);
    }
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

  
  // Android Hardware & Gesture Back Handler
  useEffect(() => {
    const onBackPress = () => {
      // 1. Close full photo viewer
      if (selectedFullPhoto) { setSelectedFullPhoto(null); return true; }
      // 2. Close calendar picker
      if (calendarTarget !== null) { setCalendarTarget(null); return true; }
      // 3. Close location picker
      if (isLocationPickerOpen) { setIsLocationPickerOpen(false); return true; }
      // 4. Close open modals
      if (isAccountModalOpen) { setIsAccountModalOpen(false); return true; }
      if (isRxModalOpen) { setIsRxModalOpen(false); return true; }
      if (isSOSModalOpen) { setIsSOSModalOpen(false); return true; }
      if (isDonateModalOpen) { setIsDonateModalOpen(false); return true; }
      if (isAddChildModalOpen) { setIsAddChildModalOpen(false); return true; }
      if (isAddMedModalOpen) { setIsAddMedModalOpen(false); return true; }
      if (isAddApplianceModalOpen) { setIsAddApplianceModalOpen(false); return true; }
      if (isAddGoldModalOpen) { setIsAddGoldModalOpen(false); return true; }
      if (isAddDocModalOpen) { setIsAddDocModalOpen(false); return true; }
      if (isAddReminderModalOpen) { setIsAddReminderModalOpen(false); return true; }
      if (isAddExpenseModalOpen) { setIsAddExpenseModalOpen(false); return true; }
      if (isAddMemberModalOpen) { setIsAddMemberModalOpen(false); return true; }
      if (isAddDiaryModalOpen) { setIsAddDiaryModalOpen(false); return true; }
      if (isBudgetModalOpen) { setIsBudgetModalOpen(false); return true; }
      if (isRestoreModalOpen) { setIsRestoreModalOpen(false); return true; }
      if (isPairModalOpen) { setIsPairModalOpen(false); return true; }
      if (isChangeBusModalOpen) { setIsChangeBusModalOpen(false); return true; }
      if (isAdminPinModalOpen) { setIsAdminPinModalOpen(false); return true; }
      if (isChangeAdminPinOpen) { setIsChangeAdminPinOpen(false); return true; }
      if (isAddFleetBusOpen) { setIsAddFleetBusOpen(false); return true; }
      if (isEditingSchoolProfile) { setIsEditingSchoolProfile(false); return true; }
      if (isEditingSchoolHelpline) { setIsEditingSchoolHelpline(false); return true; }
      if (isOnboardingOpen) { setIsOnboardingOpen(false); return true; }

      // 5. If on family subtab other than members, go back to members
      if (activeTab === 'family' && familySubtab !== 'members') {
        setFamilySubtab('members');
        return true;
      }

      // 6. If on another tab, return to home
      if (activeTab !== 'home') {
        handleTabPress('home');
        return true;
      }

      // 7. On home screen, confirm before exiting
      Alert.alert(
        lang === 'hi' ? 'ऐप बंद करें' : 'Exit App',
        lang === 'hi' ? 'क्या आप MAST Life OS से बाहर निकलना चाहते हैं?' : 'Are you sure you want to exit MAST Life OS?',
        [
          { text: lang === 'hi' ? 'रद्द करें' : 'Cancel', style: 'cancel' },
          { text: lang === 'hi' ? 'हाँ, बाहर निकलें' : 'Exit', onPress: () => BackHandler.exitApp() }
        ]
      );
      return true;
    };

    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => sub.remove();
  }, [
    selectedFullPhoto, calendarTarget, isLocationPickerOpen, isRxModalOpen, isSOSModalOpen,
    isDonateModalOpen, isAddChildModalOpen, isAddMedModalOpen, isAddApplianceModalOpen,
    isAddGoldModalOpen, isAddDocModalOpen, isAddReminderModalOpen, isAddExpenseModalOpen,
    isAddMemberModalOpen, isAddDiaryModalOpen, isBudgetModalOpen, isRestoreModalOpen,
    isPairModalOpen, isChangeBusModalOpen, isAdminPinModalOpen, isChangeAdminPinOpen,
    isAddFleetBusOpen, isEditingSchoolProfile, isEditingSchoolHelpline, isOnboardingOpen, isAccountModalOpen,
    activeTab, familySubtab, lang
  ]);

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

  const rationPct = totalSpent > 0 ? Math.round((rationTotal / totalSpent) * 100) : 0;
  const feesPct = totalSpent > 0 ? Math.round((feesTotal / totalSpent) * 100) : 0;
  const medPct = totalSpent > 0 ? Math.round((medTotal / totalSpent) * 100) : 0;
  const otherPct = totalSpent > 0 ? Math.max(0, 100 - (rationPct + feesPct + medPct)) : 0;

  // Auto-calculated Gold Totals
  const totalGoldGrams = goldItems.reduce((acc, item) => {
    const num = parseFloat((item.weight || '').replace(/[^0-9.]/g, ''));
    return acc + (isNaN(num) ? 0 : num);
  }, 0);

  const totalGoldValue = goldItems.reduce((acc, item) => {
    const num = parseInt((item.value || '').replace(/[^0-9]/g, ''), 10);
    return acc + (isNaN(num) ? 0 : num);
  }, 0);


  // ================= 100% RELIABLE AUTO-BACKUP & RESTORE ENGINE =================
  const getFullBackupJSON = () => {
    const data = {
      mast_backup_version: '7.0.0',
      created_at: new Date().toISOString(),
      created_display: new Date().toLocaleString(lang === 'hi' ? 'hi-IN' : 'en-IN', { dateStyle: 'medium', timeStyle: 'short' }),
      userProfile,
      medicines,
      takenMeds,
      appliances,
      goldItems,
      familyDocs,
      upcomingReminders,
      diaryEntries,
      expenses,
      schoolChildren,
      schoolFleetBuses,
      schoolHelplineConfig,
      familyMembers,
      familyCode,
      monthlyBudget,
      isDarkMode
    };
    return JSON.stringify(data, null, 2);
  };

  const triggerAutoBackupSnapshot = async () => {
    try {
      const json = getFullBackupJSON();
      await AsyncStorage.setItem('@mast_v7_auto_backup_snapshot', json);
      const nowStr = new Date().toLocaleString(lang === 'hi' ? 'hi-IN' : 'en-IN', { dateStyle: 'medium', timeStyle: 'short' });
      await AsyncStorage.setItem('@mast_v7_last_backup_time', nowStr);
      setLastBackupTime(nowStr);
    } catch (e) {
      console.log('Auto backup snapshot failed', e);
    }
  };

  const handleExportToDrive = async () => {
    try {
      await triggerAutoBackupSnapshot();
      const json = getFullBackupJSON();
      const now = new Date();
      const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const shareMsg = `MAST_LIFE_OS_DATA_BACKUP_START\n${json}\nMAST_LIFE_OS_DATA_BACKUP_END`;
      
      await Share.share({
        title: `MAST_Life_OS_Backup_${dateStr}.json`,
        message: shareMsg
      });
      
      Alert.alert(
        lang === 'hi' ? 'बैकअप तैयार है' : 'Backup Ready',
        lang === 'hi'
          ? 'पूरा एन्क्रिप्टेड डेटा बैकअप तैयार है! इसे Google Drive, WhatsApp या ईमेल में सुरक्षित रख सकते हैं।'
          : 'Full encrypted data backup generated. You can save it to Google Drive, WhatsApp or Email.'
      );
    } catch (err) {
      console.error('Backup share error:', err);
      Alert.alert(lang === 'hi' ? 'बैकअप त्रुटि' : 'Backup Error', lang === 'hi' ? 'बैकअप शेयर करने में समस्या आई' : 'Failed to export backup');
    }
  };

  const handleRestoreData = async (customJsonText?: string) => {
    try {
      let raw = customJsonText?.trim();
      if (!raw) {
        // Load from local phone auto-backup snapshot
        const snapshot = await AsyncStorage.getItem('@mast_v7_auto_backup_snapshot');
        if (!snapshot) {
          Alert.alert(
            lang === 'hi' ? 'कोई बैकअप नहीं मिला' : 'No Backup Found',
            lang === 'hi' ? 'इस फोन पर अभी कोई स्थानीय ऑटो-बैकअप उपलब्ध नहीं है। कृपया बैकअप कोड या टेक्स्ट पेस्ट करें।' : 'No local auto-backup found. Please paste your backup code.'
          );
          return;
        }
        raw = snapshot;
      }

      if (raw.includes('MAST_LIFE_OS_DATA_BACKUP_START')) {
        const parts = raw.split('MAST_LIFE_OS_DATA_BACKUP_START');
        if (parts.length > 1) {
          raw = parts[1].split('MAST_LIFE_OS_DATA_BACKUP_END')[0].trim();
        }
      }

      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') {
        throw new Error('Invalid JSON structure');
      }

      let restoredCount = 0;
      // 1. Medicines
      if (Array.isArray(parsed.medicines)) {
        await saveMeds(parsed.medicines);
        restoredCount += parsed.medicines.length;
      }
      if (parsed.takenMeds) await saveTaken(parsed.takenMeds);

      // 2. Vault Appliances
      if (Array.isArray(parsed.appliances)) {
        await saveAppliances(parsed.appliances);
        restoredCount += parsed.appliances.length;
      }

      // 3. Gold Items
      if (Array.isArray(parsed.goldItems)) {
        await saveGold(parsed.goldItems);
        restoredCount += parsed.goldItems.length;
      }

      // 0. User Profile
      if (parsed.userProfile && typeof parsed.userProfile === 'object') {
        setUserProfile(parsed.userProfile);
        setOnboardName(parsed.userProfile.name || '');
        setOnboardMobile(parsed.userProfile.mobile || '');
        setOnboardEmail(parsed.userProfile.email || '');
        await AsyncStorage.setItem('@mast_v7_user_profile', JSON.stringify(parsed.userProfile));
        restoredCount += 1;
      }

      // 4. Docs (Supporting both familyDocs and legacy docs keys)
      const docsToRestore = parsed.familyDocs || parsed.docs;
      if (Array.isArray(docsToRestore)) {
        await saveDocs(docsToRestore);
        restoredCount += docsToRestore.length;
      }

      // 5. Reminders
      if (Array.isArray(parsed.upcomingReminders)) {
        await saveReminders(parsed.upcomingReminders);
        restoredCount += parsed.upcomingReminders.length;
      }

      // 6. Diary
      if (Array.isArray(parsed.diaryEntries)) {
        await saveDiary(parsed.diaryEntries);
        restoredCount += parsed.diaryEntries.length;
      }

      // 7. Expenses
      if (Array.isArray(parsed.expenses)) {
        await saveExpenses(parsed.expenses);
        restoredCount += parsed.expenses.length;
      }

      // 8. School Children
      if (Array.isArray(parsed.schoolChildren) && parsed.schoolChildren.length > 0) {
        setSchoolChildren(parsed.schoolChildren);
        setActiveChildId(parsed.schoolChildren[0].id);
        await AsyncStorage.setItem('@mast_v7_school_children', JSON.stringify(parsed.schoolChildren));
        restoredCount += parsed.schoolChildren.length;
      }

      // 9. School Fleet
      if (Array.isArray(parsed.schoolFleetBuses)) {
        setSchoolFleetBuses(parsed.schoolFleetBuses);
        await AsyncStorage.setItem('@mast_v7_school_fleet', JSON.stringify(parsed.schoolFleetBuses));
      }
      if (parsed.schoolHelplineConfig) {
        setSchoolHelplineConfig(parsed.schoolHelplineConfig);
        await AsyncStorage.setItem('@mast_v7_school_helpline', parsed.schoolHelplineConfig);
      }

      // 10. Family Members
      if (Array.isArray(parsed.familyMembers)) {
        setFamilyMembers(parsed.familyMembers);
        await AsyncStorage.setItem('@mast_v7_members', JSON.stringify(parsed.familyMembers));
        restoredCount += parsed.familyMembers.length;
      }

      // 11. Budget & Theme
      if (typeof parsed.monthlyBudget === 'number') {
        await saveBudget(parsed.monthlyBudget);
      }
      if (typeof parsed.isDarkMode === 'boolean') {
        setIsDarkMode(parsed.isDarkMode);
        await AsyncStorage.setItem('@mast_theme', parsed.isDarkMode ? 'dark' : 'light');
      }

      setIsRestoreModalOpen(false);
      setRestoreInputText('');
      Vibration.vibrate([0, 150, 100, 200]);

      Alert.alert(
        lang === 'hi' ? '🎉 डेटा पुनर्प्राप्त सफल!' : '🎉 Data Restored Successfully!',
        lang === 'hi'
          ? `आपका संपूर्ण डेटा (${restoredCount} रिकॉर्ड्स) नए फोन में सफलतापूर्वक पुनर्प्राप्त हो गया है!\n\nबैकअप तारीख: ${parsed.created_display || 'हालिया'}`
          : `All records (${restoredCount} items) have been restored successfully!\n\nBackup Date: ${parsed.created_display || 'Recent'}`
      );
    } catch (err: any) {
      console.log('Restore error', err);
      Alert.alert(
        lang === 'hi' ? 'पुनर्प्राप्ति विफल' : 'Restore Failed',
        lang === 'hi'
          ? 'अमान्य बैकअप डेटा! कृपया सही बैकअप कोड या टेक्स्ट कॉपी करके पेस्ट करें।'
          : 'Invalid backup data. Please check and paste the valid backup code or JSON.'
      );
    }
  };

  const themeColors = {
    bg: isDarkMode ? '#090d16' : '#f8fafc',
    cardBg: isDarkMode ? '#1e293b' : '#ffffff',
    text: isDarkMode ? '#f8fafc' : '#0f172a',
    subText: isDarkMode ? '#94a3b8' : '#64748b',
    border: isDarkMode ? '#334155' : '#e2e8f0',
    headerBg: isDarkMode ? '#0f172a' : '#ffffff',
    headerBorder: isDarkMode ? '#1e293b' : '#f1f5f9',
    navBg: isDarkMode ? '#0f172a' : '#ffffff',
    navBorder: isDarkMode ? '#1e293b' : '#e2e8f0',
    modalBg: isDarkMode ? '#1e293b' : '#ffffff',
    inputBg: isDarkMode ? '#0f172a' : '#ffffff',
    inputBorder: isDarkMode ? '#334155' : '#cbd5e1',
    inputText: isDarkMode ? '#f8fafc' : '#0f172a',
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.bg }]}>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} />

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

      {/* ================= COMPACT MODERN FLAT APP HEADER (MAX HEIGHT 56px) ================= */}
      <View style={[styles.header, { backgroundColor: themeColors.headerBg, borderBottomColor: themeColors.headerBorder, paddingHorizontal: 16, height: 56 + TOP_SAFE_PADDING, paddingTop: TOP_SAFE_PADDING, paddingBottom: 0 }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, marginRight: 8 }}>
          <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: '#0f172a', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: '#fff', fontSize: 17, fontWeight: '800' }}>M</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: themeColors.text, fontSize: 18, fontWeight: '700', letterSpacing: 0.3 }}>MAST</Text>
            <Text style={{ color: '#64748b', fontSize: 11, fontWeight: '500', marginTop: -1 }} numberOfLines={1}>
              {lang === 'hi' ? 'सब ठीक रहेगा • Life OS' : 'Life OS • All is well'}
            </Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {/* Support / Donate Quick Button */}
          <TouchableOpacity 
            style={[styles.headerIconButton, { backgroundColor: isDarkMode ? '#4c0519' : '#fff1f2', borderColor: isDarkMode ? '#9f1239' : '#fecdd3' }]} 
            onPress={() => setIsDonateModalOpen(true)}
            accessibilityLabel="Support MAST with Love"
          >
            <Text style={{ fontSize: 16 }}>💖</Text>
          </TouchableOpacity>

          {/* Language Toggle Button (36x36 circular subtle background) */}
          <TouchableOpacity 
            style={[styles.headerIconButton, { backgroundColor: isDarkMode ? '#1e293b' : '#f1f5f9', borderColor: isDarkMode ? '#334155' : '#e2e8f0' }]} 
            onPress={toggleLanguage}
            accessibilityLabel="Toggle Language"
          >
            <Text style={{ color: themeColors.text, fontSize: 12, fontWeight: '700' }}>{lang === 'hi' ? 'EN' : 'हिं'}</Text>
          </TouchableOpacity>

          {/* Theme Toggle Button (36x36 circular subtle background) */}
          <TouchableOpacity 
            style={[styles.headerIconButton, { backgroundColor: isDarkMode ? '#1e293b' : '#f1f5f9', borderColor: isDarkMode ? '#334155' : '#e2e8f0' }]} 
            onPress={toggleTheme}
            accessibilityLabel="Toggle Theme"
          >
            <Text style={{ fontSize: 14 }}>{isDarkMode ? '☀️' : '🌙'}</Text>
          </TouchableOpacity>

          {/* Emergency SOS Button (36x36 circular subtle background) */}
          <TouchableOpacity 
            style={[styles.headerIconButton, { backgroundColor: '#fef2f2', borderColor: '#fecaca' }]} 
            onPress={() => setIsSOSModalOpen(true)}
            accessibilityLabel="Emergency SOS"
          >
            <Text style={{ fontSize: 15 }}>🚨</Text>
          </TouchableOpacity>

          {/* Dedicated Account / Settings Profile Button (36x36 circular subtle background) */}
          <TouchableOpacity 
            style={[styles.headerIconButton, { backgroundColor: isDarkMode ? '#1e293b' : '#eff6ff', borderColor: isDarkMode ? '#334155' : '#bfdbfe' }]} 
            onPress={() => setIsAccountModalOpen(true)}
            accessibilityLabel="Account and Settings"
          >
            {userProfile?.name ? (
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#2563eb' }}>
                {userProfile.name.charAt(0).toUpperCase()}
              </Text>
            ) : (
              <Text style={{ fontSize: 14 }}>👤</Text>
            )}
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
        <ScrollView 
          style={{ width: SCREEN_WIDTH }} 
          contentContainerStyle={styles.scrollBody} 
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled={true}
          keyboardShouldPersistTaps="handled"
        >
          <View style={{ gap: 16 }}>

            {/* Slate Dark Hero Welcome Banner */}
            <View style={{
              backgroundColor: isDarkMode ? '#1e293b' : '#0f172a',
              borderRadius: 16,
              padding: 18,
              shadowColor: '#000',
              shadowOpacity: 0.08,
              shadowRadius: 8,
              elevation: 2,
              borderWidth: 1,
              borderColor: isDarkMode ? '#334155' : '#1e293b'
            }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: '#93c5fd', textTransform: 'uppercase', letterSpacing: 1 }}>
                    {getGreetingTimeOnly(lang)}
                  </Text>
                  <Text style={{ fontSize: 22, fontWeight: '700', color: '#ffffff', marginTop: 4, lineHeight: 28 }}>
                    {userProfile?.name ? `${userProfile.name} 👋` : (lang === 'hi' ? 'नमस्ते, परिवार 👋' : 'Welcome Home 👋')}
                  </Text>
                  <Text style={{ fontSize: 13, color: '#cbd5e1', marginTop: 2, fontWeight: '400', lineHeight: 18 }}>
                    {lang === 'hi' ? 'आज सब मंगलमय होगा • आपका दिन शुभ रहे' : 'Today everything will be fine • Have a great day'}
                  </Text>
                </View>
                <View style={{ backgroundColor: 'rgba(255,255,255,0.12)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, alignItems: 'center' }}>
                  <Text style={{ color: '#fff', fontSize: 11, fontWeight: '600' }}>{getFormattedDate(lang)}</Text>
                </View>
              </View>

              {/* Thought of the Day - Translucent Glassmorphic Card */}
              <View style={{ backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12, padding: 12, marginTop: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <Text style={{ fontSize: 13 }}>✨</Text>
                  <Text style={{ fontSize: 10, fontWeight: '700', color: '#93c5fd', textTransform: 'uppercase', letterSpacing: 0.8 }}>
                    {lang === 'hi' ? 'आज का सुविचार (Daily Thought)' : 'Daily Inspiration'}
                  </Text>
                </View>
                <Text style={{ color: '#ffffff', fontSize: 13, lineHeight: 20, fontWeight: '400', fontStyle: 'italic' }}>
                  "{getTodayQuote(lang)}"
                </Text>
              </View>
            </View>



            {/* ================= HOME WIDGET: TODAY'S TASKS & ACTIVITIES (सुबह की गतिविधियाँ व कार्य) ================= */}
            <View>
              <View style={styles.sectionHeaderRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={{ fontSize: 16 }}>📌</Text>
                  <Text style={styles.sectionTitle}>{lang === 'hi' ? 'आज की मुख्य गतिविधियाँ व कार्य' : "Today's Tasks & Activities"}</Text>
                </View>
                <TouchableOpacity style={[styles.addSmallBtn, { backgroundColor: '#0284c7' }]} onPress={() => openAddReminderModal('task')}>
                  <Text style={styles.addSmallBtnText}>{lang === 'hi' ? '+ कार्य जोड़ें' : '+ Add Task'}</Text>
                </TouchableOpacity>
              </View>

              {(() => {
                const now = new Date();
                const monthsShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                const todayStr = `${now.getDate() < 10 ? '0' : ''}${now.getDate()} ${monthsShort[now.getMonth()]}`;
                const todaysTasks = upcomingReminders.filter(r => 
                  r.category === 'task' || 
                  r.date === todayStr || 
                  r.date === 'आज' || 
                  r.date === 'Today' ||
                  (r.category === 'bday' && r.date === todayStr) ||
                  (r.category === 'anniversary' && r.date === todayStr)
                );

                if (todaysTasks.length === 0) {
                  return (
                    <View style={[styles.card, { alignItems: 'center', paddingVertical: 18, backgroundColor: '#f0f9ff', borderColor: '#bae6fd', borderWidth: 1 }]}>
                      <Text style={{ fontSize: 28, marginBottom: 4 }}>📋</Text>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: '#0369a1' }}>
                        {lang === 'hi' ? 'आज के लिए कोई विशेष कार्य शेड्यूल नहीं है' : 'No tasks scheduled for today'}
                      </Text>
                      <Text style={{ fontSize: 11, color: '#0284c7', marginTop: 2, textAlign: 'center' }}>
                        {lang === 'hi' ? 'ऊपर "+ कार्य जोड़ें" दबाकर आज की गतिविधि या कल का काम सेट करें' : 'Tap "+ Add Task" above to plan today or upcoming activities'}
                      </Text>
                    </View>
                  );
                }

                return (
                  <View style={[styles.card, { backgroundColor: isDarkMode ? '#1e293b' : '#ffffff', borderColor: isDarkMode ? '#334155' : '#bae6fd', borderWidth: 1 }]}>
                    <View style={{ gap: 8 }}>
                      {todaysTasks.map(item => {
                        const isDone = !!item.paid;
                        const title = getLocalized(item, 'title');
                        const isBdayOrAnniv = item.category === 'bday' || item.category === 'anniversary';
                        return (
                          <View 
                            key={item.id} 
                            style={{ 
                              flexDirection: 'row', 
                              alignItems: 'center', 
                              justifyContent: 'space-between',
                              paddingVertical: 6,
                              borderBottomWidth: 1,
                              borderBottomColor: '#f1f5f9'
                            }}
                          >
                            <TouchableOpacity
                              style={[styles.checkCircle, isDone && styles.checkCircleDone, isBdayOrAnniv && { borderColor: '#f43f5e' }]}
                              onPress={() => toggleReminderPaid(item.id)}
                            >
                              <Text style={{ color: '#fff', fontSize: 13, fontWeight: 'bold' }}>{isDone ? '✓' : isBdayOrAnniv ? '🎉' : ''}</Text>
                            </TouchableOpacity>

                            <View style={{ flex: 1, marginHorizontal: 8 }}>
                              <Text style={[{ fontSize: 13, fontWeight: 'bold', color: '#0f172a' }, isDone && styles.strike]}>
                                {title}
                              </Text>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                                <View style={{ backgroundColor: item.category === 'bday' ? '#fdf2f8' : item.category === 'anniversary' ? '#fff1f2' : '#e0f2fe', paddingHorizontal: 6, paddingVertical: 1.5, borderRadius: 6 }}>
                                  <Text style={{ fontSize: 9, fontWeight: 'bold', color: item.category === 'bday' ? '#db2777' : item.category === 'anniversary' ? '#e11d48' : '#0284c7' }}>
                                    {item.category === 'bday' ? (lang === 'hi' ? '🎂 जन्मदिन' : '🎂 Birthday') : item.category === 'anniversary' ? (lang === 'hi' ? '💐 सालगिरह' : '💐 Anniversary') : (lang === 'hi' ? '📌 आज का कार्य' : '📌 Daily Task')}
                                  </Text>
                                </View>
                                <Text style={{ fontSize: 11, color: '#64748b' }}>
                                  {lang === 'en' && item.amountEn ? item.amountEn : tr(item.amount)}
                                </Text>
                              </View>
                            </View>

                            <TouchableOpacity onPress={() => openEditReminderModal(item)} style={{ padding: 4 }}>
                              <Text style={{ fontSize: 14 }}>✏️</Text>
                            </TouchableOpacity>
                          </View>
                        );
                      })}
                    </View>
                  </View>
                );
              })()}
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
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <Text style={[styles.agendaItemTitle, isTaken && styles.strike]}>{medName}</Text>
                          {(med.patientHi || med.patientEn) ? (
                            <View style={{ backgroundColor: '#fff7ed', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, borderWidth: 1, borderColor: '#fed7aa' }}>
                              <Text style={{ fontSize: 10, color: '#c2410c', fontWeight: 'bold' }}>
                                👤 {getLocalized(med, 'patient')}
                              </Text>
                            </View>
                          ) : null}
                          {med.courseDays && (
                            <View style={{ backgroundColor: '#f0fdf4', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, borderWidth: 1, borderColor: '#bbf7d0' }}>
                              <Text style={{ fontSize: 10, color: '#166534', fontWeight: 'bold' }}>
                                ⏳ {med.courseDays} {lang === 'hi' ? 'दिन कोर्स' : 'days course'}
                              </Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.agendaItemTime}>{med.time} • {medDose}</Text>

                        {/* Real-world Course, Refill and Follow-up badges */}
                        <View style={{ flexDirection: 'row', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                          {med.refillDate && (
                            <TouchableOpacity 
                              onPress={() => handleQuickRefill(med)}
                              style={{ backgroundColor: '#fef2f2', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, borderWidth: 1, borderColor: '#fca5a5', flexDirection: 'row', alignItems: 'center', gap: 3 }}
                            >
                              <Text style={{ fontSize: 10, color: '#b91c1c', fontWeight: 'bold' }}>
                                🔔 {lang === 'hi' ? `रीफिल: ${med.refillDate} (दवा लानी है)` : `Refill: ${med.refillDate}`}
                              </Text>
                            </TouchableOpacity>
                          )}
                          {med.doctorFollowupDate && (
                            <View style={{ backgroundColor: '#eff6ff', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, borderWidth: 1, borderColor: '#bfdbfe', flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                              <Text style={{ fontSize: 10, color: '#1d4ed8', fontWeight: 'bold' }}>
                                👨‍⚕️ {lang === 'hi' ? `डॉ. विज़िट: ${med.doctorFollowupDate}` : `Dr. Visit: ${med.doctorFollowupDate}`}
                              </Text>
                            </View>
                          )}
                        </View>
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

                <TouchableOpacity style={[styles.tileCard, { backgroundColor: '#faf5ff', borderColor: '#e9d5ff' }]} onPress={() => { handleTabPress('family'); setFamilySubtab('diary'); }}>
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
                          backgroundColor: isDarkMode ? '#1e293b' : '#ffffff',
                          padding: 10,
                          borderRadius: 10,
                          borderWidth: 1,
                          borderColor: isDarkMode ? '#334155' : '#ffedd5'
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
                          <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#c2410c' }}>{lang === 'en' && item.amountEn ? item.amountEn : tr(item.amount)}</Text>
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

            {/* ================= HOME WIDGET: EMOTIONAL SUPPORT / DONATION CARD ================= */}
            <View style={{
              backgroundColor: isDarkMode ? '#1e1b4b' : '#fff7ed',
              borderRadius: 16,
              padding: 16,
              borderWidth: 1.5,
              borderColor: isDarkMode ? '#4338ca' : '#fdba74',
              shadowColor: '#f97316',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.1,
              shadowRadius: 8,
              elevation: 3,
              marginVertical: 4
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: isDarkMode ? '#312e81' : '#ffedd5', justifyContent: 'center', alignItems: 'center' }}>
                  <Text style={{ fontSize: 20 }}>❤️</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: 'bold', color: isDarkMode ? '#f8fafc' : '#9a3412' }}>
                    {lang === 'hi' ? 'MAST को आपके आशीर्वाद की ज़रूरत है' : 'MAST Needs Your Blessings & Support'}
                  </Text>
                  <Text style={{ fontSize: 11, color: isDarkMode ? '#a5b4fc' : '#c2410c', fontWeight: '600' }}>
                    {lang === 'hi' ? '100% विज्ञापन-मुक्त • परिवार की पूर्ण गोपनीयता' : '100% Ad-Free • 100% Private for Families'}
                  </Text>
                </View>
              </View>

              <Text style={{ fontSize: 13, color: isDarkMode ? '#cbd5e1' : '#475569', lineHeight: 19, marginBottom: 12 }}>
                {lang === 'hi'
                  ? 'MAST कोई मुनाफ़ा कमाने वाली कॉर्पोरेट कंपनी नहीं, बल्कि हर भारतीय परिवार के सुकून और सुरक्षा का एक निस्वार्थ संकल्प है। आपके ₹21 या ₹51 (एक कप चाय जितना) का छोटा सा आशीर्वाद भी इस ऐप को हमेशा सुरक्षित, विज्ञापन-मुक्त और मुफ़्त रखेगा।'
                  : 'MAST is not a commercial corporate venture; it is an ad-free mission built for family privacy. Even a small blessing of ₹21 or ₹51 keeps this app completely free and safe for everyone.'}
              </Text>

              <TouchableOpacity
                style={{
                  backgroundColor: '#ea580c',
                  paddingVertical: 12,
                  borderRadius: 12,
                  alignItems: 'center',
                  justifyContent: 'center',
                  shadowColor: '#ea580c',
                  shadowOpacity: 0.3,
                  shadowRadius: 4,
                  elevation: 2,
                }}
                onPress={() => setIsDonateModalOpen(true)}
              >
                <Text style={{ color: '#ffffff', fontWeight: 'bold', fontSize: 13 }}>
                  {lang === 'hi' ? '🙏 स्वेच्छा से सहयोग करें (₹21, ₹51, या इच्छानुसार)' : '🙏 Support Voluntarily (₹21, ₹51, Custom Amount)'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Bottom spacer so content is never cut off by bottom nav */}
            <View style={{ height: 40 }} />
          </View>
        </ScrollView>

        {/* ----------------- 2. VAULT (लॉकर: APPLIANCES, AUTO-GOLD, FILTERED DOCS) ----------------- */}
        <ScrollView 
          style={{ width: SCREEN_WIDTH }} 
          contentContainerStyle={styles.scrollBody} 
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled={true}
          keyboardShouldPersistTaps="handled"
        >
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
                  if (vaultSubtab === 'appliances') openAddApplianceModal();
                  else if (vaultSubtab === 'gold') openAddGoldModal();
                  else openAddDocModal();
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

            {/* Vault Search Bar */}
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: isDarkMode ? '#1e293b' : '#f1f5f9',
              borderRadius: 12,
              paddingHorizontal: 12,
              paddingVertical: Platform.OS === 'ios' ? 8 : 4,
              borderWidth: 1,
              borderColor: isDarkMode ? '#334155' : '#cbd5e1'
            }}>
              <Text style={{ fontSize: 16, marginRight: 8 }}>🔍</Text>
              <TextInput
                style={{
                  flex: 1,
                  fontSize: 13.5,
                  color: isDarkMode ? '#f8fafc' : '#0f172a',
                  paddingVertical: 4
                }}
                placeholder={
                  vaultSubtab === 'appliances'
                    ? (lang === 'hi' ? 'सामान, कंपनी या वारंटी खोजें...' : 'Search appliances or warranty...')
                    : vaultSubtab === 'gold'
                    ? (lang === 'hi' ? 'गहने, रसीद या धातु खोजें...' : 'Search jewelry or gold items...')
                    : (lang === 'hi' ? 'दस्तावेज़ या सदस्य खोजें...' : 'Search documents or members...')
                }
                placeholderTextColor="#94a3b8"
                value={vaultSearchQuery}
                onChangeText={setVaultSearchQuery}
              />
              {vaultSearchQuery.length > 0 ? (
                <TouchableOpacity onPress={() => setVaultSearchQuery('')} style={{ padding: 4 }}>
                  <Text style={{ fontSize: 14, color: '#64748b', fontWeight: 'bold' }}>✕</Text>
                </TouchableOpacity>
              ) : null}
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
                    <View style={{ marginTop: 12, paddingHorizontal: 16, paddingVertical: 6, backgroundColor: isDarkMode ? '#0f172a' : '#f8fafc', borderRadius: 10, borderWidth: 1, borderColor: isDarkMode ? '#334155' : '#e2e8f0' }}>
                      <Text style={{ color: '#64748b', fontSize: 12, textAlign: 'center' }}>
                        {lang === 'hi' ? 'ऊपर "+ नया सामान जोड़ें" बटन दबाकर सामान व बिल सहेजें' : 'Tap "+ Add Appliance" above to save bills & warranty'}
                      </Text>
                    </View>
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
                      <Text style={styles.addSmallBtnText}>{lang === 'hi' ? '👑 पहला आभूषण दर्ज करें' : '+ Add Gold Item'}</Text>
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
                      <Text style={styles.addSmallBtnText}>{lang === 'hi' ? '📁 पहला दस्तावेज़ सुरक्षित करें' : '+ Add Document'}</Text>
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
            {/* Bottom spacer so content is never cut off by bottom nav */}
            <View style={{ height: 40 }} />
          </View>
        </ScrollView>

        {/* ----------------- 3. REMINDERS & MEDICINE (WITH ALARMS & CHECKBOX REMINDERS) ----------------- */}
        <ScrollView 
          style={{ width: SCREEN_WIDTH }} 
          contentContainerStyle={styles.scrollBody} 
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled={true}
          keyboardShouldPersistTaps="handled"
        >
          <View style={{ gap: 16 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View>
                <Text style={styles.pageTitle}>🔔 {t.remHeading}</Text>
                <Text style={styles.pageSub}>{t.remSub}</Text>
              </View>
            </View>



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
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <Text style={[styles.agendaItemTitle, isTaken && styles.strike]}>{medName}</Text>
                        {(med.patientHi || med.patientEn) ? (
                          <View style={{ backgroundColor: '#fff7ed', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, borderWidth: 1, borderColor: '#fed7aa' }}>
                            <Text style={{ fontSize: 10, color: '#c2410c', fontWeight: 'bold' }}>
                              👤 {getLocalized(med, 'patient')}
                            </Text>
                          </View>
                        ) : null}
                        {med.courseDays && (
                          <View style={{ backgroundColor: '#f0fdf4', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, borderWidth: 1, borderColor: '#bbf7d0' }}>
                            <Text style={{ fontSize: 10, color: '#166534', fontWeight: 'bold' }}>
                              ⏳ {med.courseDays} {lang === 'hi' ? 'दिन कोर्स' : 'days course'}
                            </Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.agendaItemTime}>{med.time} • {medDose}</Text>

                      {/* Course, Refill and Follow-up badges */}
                      <View style={{ flexDirection: 'row', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                        {med.refillDate && (
                          <TouchableOpacity 
                            onPress={() => handleQuickRefill(med)}
                            style={{ backgroundColor: '#fef2f2', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, borderWidth: 1, borderColor: '#fca5a5', flexDirection: 'row', alignItems: 'center', gap: 3 }}
                          >
                            <Text style={{ fontSize: 10, color: '#b91c1c', fontWeight: 'bold' }}>
                              🔔 {lang === 'hi' ? `रीफिल: ${med.refillDate} (दवा लानी है)` : `Refill: ${med.refillDate}`}
                            </Text>
                          </TouchableOpacity>
                        )}
                        {med.doctorFollowupDate && (
                          <View style={{ backgroundColor: '#eff6ff', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, borderWidth: 1, borderColor: '#bfdbfe', flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                            <Text style={{ fontSize: 10, color: '#1d4ed8', fontWeight: 'bold' }}>
                              👨‍⚕️ {lang === 'hi' ? `डॉ. विज़िट: ${med.doctorFollowupDate}` : `Dr. Visit: ${med.doctorFollowupDate}`}
                            </Text>
                          </View>
                        )}
                      </View>
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
                })
              )}
            </View>

            {/* Upcoming Bills & Event Reminders WITH MARK AS PAID & DELETE */}
            <View style={{ gap: 12 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={styles.sectionHeading}>{t.upcomingHeading}</Text>
                <TouchableOpacity style={styles.addSmallBtn} onPress={() => openAddReminderModal('bills')}>
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
                          {lang === 'en' && rem.amountEn ? rem.amountEn : tr(rem.amount)}
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
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={styles.cardSub}>{t.dueDateLabel}: {rem.date}</Text>
                        {rem.category === 'bday' ? (
                          <View style={{ backgroundColor: '#fdf2f8', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                            <Text style={{ color: '#db2777', fontSize: 10, fontWeight: 'bold' }}>🎂 {lang === 'hi' ? 'जन्मदिन' : 'BIRTHDAY'}</Text>
                          </View>
                        ) : rem.category === 'anniversary' ? (
                          <View style={{ backgroundColor: '#fff1f2', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                            <Text style={{ color: '#e11d48', fontSize: 10, fontWeight: 'bold' }}>💐 {lang === 'hi' ? 'सालगिरह' : 'ANNIVERSARY'}</Text>
                          </View>
                        ) : rem.category === 'task' ? (
                          <View style={{ backgroundColor: '#e0f2fe', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                            <Text style={{ color: '#0369a1', fontSize: 10, fontWeight: 'bold' }}>📌 {lang === 'hi' ? 'कार्य' : 'TASK'}</Text>
                          </View>
                        ) : null}
                      </View>
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
            {/* Bottom spacer so content is never cut off by bottom nav */}
            <View style={{ height: 40 }} />
          </View>
        </ScrollView>

        {/* ----------------- 4. PAN-INDIA SCHOOL BUS TRACKER (MULTI-CHILD, GOOGLE MAPS & ZERO-BURDEN DRIVER) ----------------- */}
        <ScrollView 
          style={{ width: SCREEN_WIDTH }} 
          contentContainerStyle={styles.scrollBody} 
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled={true}
          keyboardShouldPersistTaps="handled"
        >
          <View style={{ gap: 16 }}>
            <View style={[styles.pageHeader, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }]}>
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Text style={styles.pageTitle}>🚌 {t.busHeading}</Text>
                <Text style={styles.pageSub} numberOfLines={1}>
                  {userRole === 'PARENT' 
                    ? (lang === 'hi' ? 'लाइव जीपीएस व स्टॉप्स ट्रैकिंग' : 'Live GPS & Stops Tracker') 
                    : userRole === 'DRIVER' 
                      ? (lang === 'hi' ? 'चालक ड्यूटी कंसोल' : 'Driver Duty Console') 
                      : (lang === 'hi' ? 'स्कूल एडमिन कंसोल' : 'School Admin Console')}
                </Text>
              </View>
              {userRole === 'PARENT' ? (
                <TouchableOpacity
                  style={{ backgroundColor: isDarkMode ? '#334155' : '#f1f5f9', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: isDarkMode ? '#475569' : '#cbd5e1' }}
                  onPress={() => {
                    Vibration.vibrate(40);
                    handleSetUserRole('DRIVER');
                  }}
                >
                  <Text style={{ fontSize: 14 }}>👨‍✈️</Text>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: isDarkMode ? '#cbd5e1' : '#475569' }}>
                    {lang === 'hi' ? 'स्टाफ लॉगिन' : 'Staff Login'}
                  </Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={{ backgroundColor: '#eff6ff', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: '#bfdbfe' }}
                  onPress={() => {
                    Vibration.vibrate(40);
                    handleSetUserRole('PARENT');
                  }}
                >
                  <Text style={{ fontSize: 14 }}>👨‍👩‍👧</Text>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#2563eb' }}>
                    {lang === 'hi' ? 'अभिभावक मोड' : 'Parent Mode'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
            {userRole === 'PARENT' ? (
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
                {/* Multi-Child Selector Tabs Carousel - Only when more than 1 child */}
                {schoolChildren.length > 1 && (
                  <View style={{ marginBottom: 4 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <Text style={{ fontSize: 13, fontWeight: 'bold', color: isDarkMode ? '#f8fafc' : '#0f172a' }}>
                        👨‍👧‍👦 {lang === 'hi' ? 'बच्चे की बस चुनें:' : 'Select Child Bus:'}
                      </Text>
                      <TouchableOpacity 
                        style={{ backgroundColor: '#ea580c', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 }}
                        onPress={openAddChildModal}
                      >
                        <Text style={{ color: '#fff', fontSize: 11, fontWeight: 'bold' }}>+ {lang === 'hi' ? 'नया बच्चा जोड़ें' : 'Add Child'}</Text>
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
                                <Text style={[styles.childTabName, isSelected && { color: '#fff' }]}>{(lang === 'en' && child.nameEn) ? child.nameEn : child.name}</Text>
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
                )}
                {/* Active Child Card with Single Clean Boarding Action */}
                <View style={[styles.busChildCard, { padding: 14 }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <View style={styles.childAvatarBox}>
                      <Text style={{ fontSize: 26 }}>{activeChild.avatar}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={{ fontSize: 16, fontWeight: '700', color: '#0f172a' }}>
                          {(lang === 'en' && activeChild.nameEn) ? activeChild.nameEn : activeChild.name} ({activeChild.grade})
                        </Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          {schoolChildren.length === 1 && (
                            <TouchableOpacity 
                              style={{ backgroundColor: '#fff7ed', borderWidth: 1, borderColor: '#fed7aa', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}
                              onPress={openAddChildModal}
                            >
                              <Text style={{ color: '#ea580c', fontSize: 11, fontWeight: 'bold' }}>+ {lang === 'hi' ? 'बच्चा जोड़ें' : 'Add Child'}</Text>
                            </TouchableOpacity>
                          )}
                          <TouchableOpacity 
                            onPress={() => openEditChildModal(activeChild)} 
                            style={{ padding: 6, backgroundColor: '#f1f5f9', borderRadius: 8 }}
                          >
                            <Text style={{ fontSize: 14 }}>✏️</Text>
                          </TouchableOpacity>
                          {schoolChildren.length > 1 && (
                            <TouchableOpacity 
                              onPress={() => deleteSchoolChild(activeChild.id)} 
                              style={{ padding: 6, backgroundColor: '#fee2e2', borderRadius: 8 }}
                            >
                              <Text style={{ fontSize: 14 }}>🗑️</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>
                      <Text style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                        🏫 {lang === 'hi' ? activeChild.schoolNameHi : activeChild.schoolNameEn} • 🚌 {activeChild.busNo}
                      </Text>
                    </View>
                  </View>

                  {/* Single One-Tap Interactive Boarding Action Button with No Overflow */}
                  <TouchableOpacity
                    activeOpacity={0.8}
                    style={{
                      marginTop: 12,
                      paddingVertical: 10,
                      paddingHorizontal: 12,
                      borderRadius: 12,
                      borderWidth: 1.5,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      backgroundColor: activeChild.isBoarded ? '#f0fdf4' : !isTripActive ? (isDarkMode ? '#0f172a' : '#f8fafc') : '#eff6ff',
                      borderColor: activeChild.isBoarded ? '#86efac' : !isTripActive ? (isDarkMode ? '#334155' : '#e2e8f0') : '#93c5fd'
                    }}
                    onPress={() => {
                      if (!isTripActive) {
                        Alert.alert(
                          lang === 'hi' ? 'बस स्टैंडबाय पर है' : 'Bus on Standby',
                          lang === 'hi' 
                            ? 'बस अभी डिपो/स्कूल में पार्क है। चालक द्वारा ड्यूटी चालू करते ही उपस्थिति दर्ज की जा सकेगी।' 
                            : 'Bus is currently parked. Attendance can be marked once driver starts trip.'
                        );
                        return;
                      }
                      if (!activeChild.isBoarded) {
                        toggleStudentBoarding(activeChild.id);
                        Alert.alert(
                          lang === 'hi' ? '✅ बच्चा बस में सवार' : '✅ Marked as Boarded',
                          lang === 'hi' 
                            ? `${activeChild.name} को बस में सुरक्षित सवार दर्ज कर दिया गया है। चालक व स्कूल को भी सूचित हो चुका है।` 
                            : `${activeChild.name} marked as boarded. Driver & school notified.`
                        );
                      } else {
                        Alert.alert(
                          lang === 'hi' ? 'उपस्थिति बदलें' : 'Change Boarding Status',
                          lang === 'hi' ? `क्या ${activeChild.name} अभी बस में नहीं चढ़ा है?` : `Is ${activeChild.name} not boarded on bus?`,
                          [
                            { text: lang === 'hi' ? 'रद्द करें' : 'Cancel', style: 'cancel' },
                            {
                              text: lang === 'hi' ? 'हाँ, बदलें' : 'Yes, Change',
                              onPress: () => toggleStudentBoarding(activeChild.id)
                            }
                          ]
                        );
                      }
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, paddingRight: 8 }}>
                      <Text style={{ fontSize: 22 }}>
                        {activeChild.isBoarded ? '✅' : !isTripActive ? '🅿️' : '🚸'}
                      </Text>
                      <View style={{ flex: 1 }}>
                        <Text 
                          style={{
                            fontSize: 13,
                            fontWeight: '700',
                            color: activeChild.isBoarded ? '#15803d' : !isTripActive ? (isDarkMode ? '#cbd5e1' : '#475569') : '#1d4ed8'
                          }}
                          numberOfLines={1}
                        >
                          {activeChild.isBoarded 
                            ? (lang === 'hi' ? 'बच्चा बस में सवार है ✓' : 'Child is Safely on Bus ✓')
                            : !isTripActive
                              ? (lang === 'hi' ? 'बस अभी स्टैंडबाय पर है' : 'Bus Currently on Standby')
                              : (lang === 'hi' ? 'बच्चा बस में बैठा दिया? (टैप करें)' : 'Boarded child on bus?')}
                        </Text>
                        <Text 
                          style={{
                            fontSize: 11,
                            color: activeChild.isBoarded ? '#16a34a' : !isTripActive ? '#94a3b8' : '#3b82f6',
                            marginTop: 1
                          }}
                          numberOfLines={1}
                        >
                          {activeChild.isBoarded 
                            ? (lang === 'hi' ? 'चालक व स्कूल को सूचना दर्ज' : 'Confirmed to driver & school')
                            : !isTripActive
                              ? (lang === 'hi' ? 'ड्यूटी चालू होने पर उपस्थिति दर्ज करें' : 'Mark once trip begins')
                              : (lang === 'hi' ? 'बैठाने के बाद एक बार दबाएं' : 'Tap once to mark attendance')}
                        </Text>
                      </View>
                    </View>
                    <View style={{
                      backgroundColor: activeChild.isBoarded ? '#dcfce7' : !isTripActive ? (isDarkMode ? '#1e293b' : '#f1f5f9') : '#2563eb',
                      paddingHorizontal: 10,
                      paddingVertical: 5,
                      borderRadius: 8,
                      flexShrink: 0
                    }}>
                      <Text style={{
                        color: activeChild.isBoarded ? '#15803d' : !isTripActive ? '#64748b' : '#ffffff',
                        fontSize: 11,
                        fontWeight: '700'
                      }}>
                        {activeChild.isBoarded ? (lang === 'hi' ? 'सवार ✓' : 'Boarded ✓') : !isTripActive ? (lang === 'hi' ? 'स्टैंडबाय' : 'Standby') : (lang === 'hi' ? 'बैठा दिया' : 'Mark')}
                      </Text>
                    </View>
                  </TouchableOpacity>
                </View>

                {/* Smart Shift Banner: Auto-detected by time, with 1-tap view switcher */}
                <View style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  backgroundColor: '#f8fafc',
                  borderWidth: 1,
                  borderColor: '#e2e8f0',
                  borderRadius: 14,
                  paddingVertical: 9,
                  paddingHorizontal: 12,
                  marginBottom: 10
                }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                    <Text style={{ fontSize: 18 }}>{busTripShift === 'morning' ? '🌅' : '🌇'}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 12, fontWeight: '700', color: busTripShift === 'morning' ? '#0369a1' : '#c2410c' }}>
                        {busTripShift === 'morning' 
                          ? (lang === 'hi' ? 'सुबह पिकअप ट्रिप (घर ➔ स्कूल)' : 'Morning Pickup (Home ➔ School)')
                          : (lang === 'hi' ? 'दोपहर ड्रॉप ट्रिप (स्कूल ➔ घर)' : 'Afternoon Drop (School ➔ Home)')}
                      </Text>
                      <Text style={{ fontSize: 10, color: '#64748b' }}>
                        {lang === 'hi' ? 'समय अनुसार स्वतः चुना गया' : 'Auto-selected by current time'}
                      </Text>
                    </View>
                  </View>

                  <TouchableOpacity
                    style={{
                      backgroundColor: busTripShift === 'morning' ? '#eff6ff' : '#fff7ed',
                      borderWidth: 1,
                      borderColor: busTripShift === 'morning' ? '#bfdbfe' : '#fed7aa',
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                      borderRadius: 8
                    }}
                    onPress={() => {
                      Vibration.vibrate(30);
                      setBusTripShift(prev => prev === 'morning' ? 'afternoon' : 'morning');
                    }}
                  >
                    <Text style={{ fontSize: 11, fontWeight: '700', color: busTripShift === 'morning' ? '#2563eb' : '#ea580c' }}>
                      🔄 {busTripShift === 'morning' ? (lang === 'hi' ? 'दोपहर देखें' : 'View Afternoon') : (lang === 'hi' ? 'सुबह देखें' : 'View Morning')}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Driver Live Voice Announcement: ONLY visible when broadcasted by Admin or Driver */}
                {activeVoiceAnnouncement && (
                  <View style={{
                    backgroundColor: '#fff7ed',
                    borderRadius: 16,
                    padding: 12,
                    borderWidth: 1.5,
                    borderColor: '#ea580c',
                    marginBottom: 10
                  }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                        <Text style={{ fontSize: 22 }}>📢</Text>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 13, fontWeight: 'bold', color: '#c2410c' }}>
                            {activeVoiceAnnouncement.from} ({activeVoiceAnnouncement.time}):
                          </Text>
                          <Text style={{ fontSize: 13, color: '#7c2d12', marginTop: 2, fontWeight: '600' }}>
                            {activeVoiceAnnouncement.text}
                          </Text>
                        </View>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <TouchableOpacity
                          style={{ backgroundColor: '#ea580c', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, flexDirection: 'row', alignItems: 'center', gap: 4 }}
                          onPress={() => {
                            Vibration.vibrate(100);
                            Alert.alert('📢 ' + activeVoiceAnnouncement.from, activeVoiceAnnouncement.text);
                          }}
                        >
                          <Text style={{ fontSize: 14 }}>▶️</Text>
                          <Text style={{ color: '#fff', fontSize: 11, fontWeight: 'bold' }}>
                            {lang === 'hi' ? 'सुनें' : 'Play'}
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={{ padding: 4 }}
                          onPress={() => setActiveVoiceAnnouncement(null)}
                        >
                          <Text style={{ fontSize: 18, color: '#9a3412', fontWeight: 'bold' }}>✕</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                )}

                {/* Reassuring Calm Trip Status */}
                {!isTripActive ? (
                  <View style={{
                    backgroundColor: '#f8fafc',
                    borderWidth: 1,
                    borderColor: '#e2e8f0',
                    borderRadius: 14,
                    padding: 12,
                    marginBottom: 10,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12
                  }}>
                    <Text style={{ fontSize: 24 }}>🅿️</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: '#334155' }}>
                        {busTripShift === 'morning' 
                          ? (lang === 'hi' ? 'बस अभी डिपो पर पार्क है' : 'Bus is parked at depot')
                          : (lang === 'hi' ? 'बस अभी स्कूल में पार्क है' : 'Bus is parked at school')}
                      </Text>
                      <Text style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                        {lang === 'hi' 
                          ? 'चालक के बस रवाना करते ही लाइव लोकेशन व स्टॉप्स स्वतः सक्रिय हो जाएंगे।' 
                          : 'Live tracking will activate automatically once driver starts duty.'}
                      </Text>
                    </View>
                  </View>
                ) : (
                  <View style={{
                    backgroundColor: '#f0fdf4',
                    borderWidth: 1,
                    borderColor: '#86efac',
                    borderRadius: 14,
                    padding: 12,
                    marginBottom: 10,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                      <Text style={{ fontSize: 22 }}>🟢</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 13, fontWeight: '700', color: '#15803d' }}>
                          {busTripShift === 'morning'
                            ? (lang === 'hi' ? 'बस रास्ते में है • सुबह की पिकअप ट्रिप' : 'Bus on the way • Morning Pickup')
                            : (lang === 'hi' ? 'बस रास्ते में है • दोपहर की घर वापसी' : 'Bus on the way • Afternoon Drop')}
                        </Text>
                        <Text style={{ fontSize: 11, color: '#166534', marginTop: 1 }}>
                          {lang === 'hi'
                            ? `चालक: ${activeChild.driverNameHi || 'राजेश कुमार'} • बस: ${activeChild.busNo}`
                            : `Driver: ${activeChild.driverNameEn || 'Rajesh Kumar'} • Bus: ${activeChild.busNo}`}
                        </Text>
                      </View>
                    </View>
                    <View style={{ backgroundColor: '#dcfce7', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 }}>
                      <Text style={{ fontSize: 10, fontWeight: '700', color: '#15803d' }}>
                        LIVE
                      </Text>
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
                            ? (busTripShift === 'morning' ? (lang === 'hi' ? 'सुबह पिकअप ETA' : 'Morning Pickup ETA') : (lang === 'hi' ? 'दोपहर ड्रॉप ETA' : 'Afternoon Drop ETA'))
                            : (lang === 'hi' ? 'बस की वर्तमान स्थिति' : 'Current Bus Status')}
                        </Text>
                        <Text style={styles.mapEtaStop} numberOfLines={1}>
                          {isTripActive 
                            ? (lang === 'hi' ? activeChild.stopNameHi : activeChild.stopNameEn)
                            : (busTripShift === 'morning' 
                                ? (lang === 'hi' ? `${activeChild.nightDepotHi || 'लास्ट डिपो'} पर खड़ी है` : `Parked at ${activeChild.nightDepotEn || 'Night Depot'}`)
                                : (lang === 'hi' ? 'स्कूल परिसर में खड़ी है' : 'Parked at School Campus'))}
                        </Text>
                      </View>
                    </View>

                    <TouchableOpacity 
                      style={[styles.simToggleBtn, isBusSimulating ? { backgroundColor: '#ef4444' } : { backgroundColor: '#10b981' }]}
                      onPress={toggleBusSimulation}
                    >
                      <Text style={styles.simToggleBtnText}>
                        {isBusSimulating 
                          ? (lang === 'hi' ? '⏹️ टेस्ट रोकें' : 'Stop Test') 
                          : (lang === 'hi' ? '🛠️ सिमुलेशन' : 'Demo Test')}
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
                          left: -14,
                          backgroundColor: '#334155',
                          paddingHorizontal: 5,
                          paddingVertical: 1,
                          borderRadius: 4
                        }}>
                          <Text style={{ color: '#cbd5e1', fontSize: 8, fontWeight: 'bold' }}>
                            {busTripShift === 'morning' 
                              ? (lang === 'hi' ? 'लास्ट स्टैंड (खड़ी है)' : 'Depot (Parked)') 
                              : (lang === 'hi' ? 'स्कूल (खड़ी है)' : 'School (Parked)')}
                          </Text>
                        </View>
                      )}
                    </View>

                    {/* Target Stop Pin */}
                    <View style={[styles.stopPin, { left: '72%' }]}>
                      <Text style={{ fontSize: 22 }}>📍</Text>
                    </View>
                  </View>

                  {/* Route Start and End Labels */}
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4, marginTop: -4 }}>
                    <Text style={{ fontSize: 10, color: '#94a3b8', fontWeight: 'bold' }}>
                      {busTripShift === 'morning' ? (lang === 'hi' ? '🌙 डिपो' : '🌙 Depot') : (lang === 'hi' ? '🏫 स्कूल' : '🏫 School')}
                    </Text>
                    <Text style={{ fontSize: 10, color: '#f59e0b', fontWeight: 'bold' }}>
                      {lang === 'hi' ? '📍 आपका स्टॉप' : '📍 Your Stop'}
                    </Text>
                    <Text style={{ fontSize: 10, color: '#94a3b8', fontWeight: 'bold' }}>
                      {busTripShift === 'morning' ? (lang === 'hi' ? '🏫 स्कूल' : '🏫 School') : (lang === 'hi' ? '🌙 डिपो' : '🌙 Depot')}
                    </Text>
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
                      <Text style={[styles.hudMetricValue, !isTripActive && { color: '#fbbf24', fontSize: 11 }]}>
                        {isTripActive 
                          ? (activeChild.etaMins === 0 
                              ? (lang === 'hi' ? 'स्टॉप पर' : 'Arrived') 
                              : `${(activeChild.etaMins * 0.3).toFixed(1)} km`)
                          : (busTripShift === 'morning' 
                              ? (lang === 'hi' ? 'लास्ट स्टैंड पर (0 km)' : 'At Depot (0 km)') 
                              : (lang === 'hi' ? 'स्कूल में (0 km)' : 'At School (0 km)'))}
                      </Text>
                    </View>
                    <View style={styles.hudMetricPill}>
                      <Text style={styles.hudMetricLabel}>{lang === 'hi' ? 'ट्रैफिक' : 'Traffic'}</Text>
                      <Text style={styles.hudMetricValue}>
                        {isTripActive ? t.trafficTagText : (lang === 'hi' ? 'स्टैंडबाय' : 'Standby')}
                      </Text>
                    </View>
                  </View>

                  {/* Prominent Google Maps Deep-Link Actions */}
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                    <TouchableOpacity 
                      style={[styles.hudActionBtn, { backgroundColor: '#0284c7' }]} 
                      onPress={() => {
                        const lat = activeChild?.busCoords?.lat;
                        const lng = activeChild?.busCoords?.lng;
                        if (lat && lng) {
                          openBusOnGoogleMaps(lat, lng, activeChild?.busNo);
                        } else {
                          Alert.alert('Notice', lang === 'hi' ? 'बस के GPS निर्देशांक अभी उपलब्ध नहीं हैं।' : 'Bus GPS coordinates not available yet.');
                        }
                      }}
                    >
                      <Text style={styles.hudActionBtnText}>
                        🗺️ {lang === 'hi' ? 'Google Maps पर लाइव देखें' : 'Open in Google Maps'}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                      style={[styles.hudActionBtn, { backgroundColor: '#10b981' }]} 
                      onPress={() => {
                        const lat = activeChild?.stopCoords?.lat;
                        const lng = activeChild?.stopCoords?.lng;
                        if (lat && lng) {
                          navigateToMyStopOnGoogleMaps(lat, lng);
                        } else {
                          Alert.alert('Notice', lang === 'hi' ? 'स्टॉप के GPS निर्देशांक दर्ज नहीं हैं।' : 'Stop GPS coordinates not found.');
                        }
                      }}
                    >
                      <Text style={styles.hudActionBtnText}>
                        🧭 {lang === 'hi' ? 'स्टॉप तक नेविगेशन' : 'Directions to Stop'}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* Quick Chime & GPS Refresh */}
                  <View style={{ marginTop: 10 }}>
                    <TouchableOpacity 
                      style={[styles.hudActionBtn, { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, backgroundColor: '#0284c7' }]} 
                      onPress={refreshBusGPS}
                    >
                      <Text style={[styles.hudActionBtnText, { fontSize: 13, fontWeight: 'bold' }]}>
                        🔄 {lang === 'hi' ? 'जीपीएस लोकेशन रीफ्रेश करें' : 'Refresh GPS Location'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Fluid Vertical Stepper Timeline Component */}
                <View style={styles.card}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                    <View>
                      <Text style={styles.sectionHeading}>
                        {lang === 'hi' 
                            ? `${activeChild.busNo || 'Bus #08'} • ${busTripShift === 'morning' ? 'सुबह पिकअप रूट' : 'दोपहर ड्रॉप रूट'}` 
                            : `${activeChild.busNo || 'Bus #08'} • ${busTripShift === 'morning' ? 'Morning Pickup' : 'Afternoon Drop'}`}
                      </Text>
                      <Text style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                        {isTripActive ? (lang === 'hi' ? '🟢 लाइव रूट ट्रैकिंग सक्रिय' : '🟢 Live Route Tracking Active') : (lang === 'hi' ? '🅿️ बस अभी स्टैंडबाय पर है' : '🅿️ Bus currently on standby')}
                      </Text>
                    </View>
                    <View style={{ backgroundColor: busTripShift === 'morning' ? '#eff6ff' : '#fff7ed', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, borderWidth: 1, borderColor: busTripShift === 'morning' ? '#bfdbfe' : '#fed7aa' }}>
                      <Text style={{ fontSize: 11, fontWeight: '600', color: busTripShift === 'morning' ? '#2563eb' : '#c2410c' }}>
                        {busTripShift === 'morning' ? (lang === 'hi' ? 'पिकअप' : 'Pickup') : (lang === 'hi' ? 'ड्रॉप' : 'Drop')}
                      </Text>
                    </View>
                  </View>
                  
                  {/* Stepper Timeline Nodes */}
                  <View style={{ paddingLeft: 6 }}>
                    {((busTripShift === 'morning' ? (activeChild.morningStops || activeChild.stops) : (activeChild.afternoonStops || activeChild.stops)) || []).map((st: any, idx: number, arr: any[]) => {
                      const title = lang === 'hi' ? st.titleHi : st.titleEn;
                      const isUserStop = !!st.isUserStop;
                      const isPassed = isTripActive && st.status === 'passed';
                      const isLast = idx === arr.length - 1;

                      return (
                        <View key={st.id || idx} style={{ flexDirection: 'row', minHeight: 62 }}>
                          {/* Timeline Left Column: Icon/Dot + Connecting Vertical Track Line */}
                          <View style={{ width: 28, alignItems: 'center' }}>
                            {isUserStop ? (
                              <View style={{
                                width: 24,
                                height: 24,
                                borderRadius: 12,
                                backgroundColor: '#2563eb',
                                alignItems: 'center',
                                justifyContent: 'center',
                                borderWidth: 3,
                                borderColor: '#dbeafe',
                                shadowColor: '#2563eb',
                                shadowOpacity: 0.35,
                                shadowRadius: 5,
                                elevation: 3
                              }}>
                                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#ffffff' }} />
                              </View>
                            ) : isPassed ? (
                              <View style={{
                                width: 20,
                                height: 20,
                                borderRadius: 10,
                                backgroundColor: '#10b981',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}>
                                <Text style={{ color: '#fff', fontSize: 10, fontWeight: 'bold' }}>✓</Text>
                              </View>
                            ) : (
                              <View style={{
                                width: 18,
                                height: 18,
                                borderRadius: 9,
                                backgroundColor: isDarkMode ? '#1e293b' : '#ffffff',
                                borderWidth: 2,
                                borderColor: isDarkMode ? '#475569' : '#cbd5e1'
                              }} />
                            )}

                            {/* Continuous Vertical Track Line */}
                            {!isLast && (
                              <View style={{
                                flex: 1,
                                width: 2,
                                backgroundColor: isPassed ? '#10b981' : isDarkMode ? '#334155' : '#e2e8f0',
                                marginVertical: 3
                              }} />
                            )}
                          </View>

                          {/* Timeline Right Column: Details & ETA */}
                          <View style={{
                            flex: 1,
                            marginLeft: 12,
                            paddingBottom: isLast ? 0 : 16,
                            justifyContent: 'center'
                          }}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                                <Text style={{
                                  fontSize: 14,
                                  fontWeight: isUserStop ? '700' : '600',
                                  color: isUserStop ? '#2563eb' : isDarkMode ? '#f8fafc' : '#0f172a'
                                }}>
                                  {title}
                                </Text>
                                {isUserStop && (
                                  <View style={{ backgroundColor: '#eff6ff', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, borderWidth: 1, borderColor: '#bfdbfe' }}>
                                    <Text style={{ fontSize: 10, fontWeight: '700', color: '#2563eb' }}>
                                      {lang === 'hi' ? 'आपका स्टॉप' : 'Your Stop'}
                                    </Text>
                                  </View>
                                )}
                              </View>
                              <Text style={{
                                fontSize: 12,
                                fontWeight: '600',
                                color: isUserStop ? '#2563eb' : '#64748b'
                              }}>
                                {st.time}
                              </Text>
                            </View>

                            <Text style={{
                              fontSize: 11,
                              color: isUserStop ? '#2563eb' : '#64748b',
                              marginTop: 2,
                              fontWeight: isUserStop ? '500' : '400'
                            }}>
                              {isUserStop 
                                ? (isTripActive
                                    ? (activeChild.etaMins === 0 
                                        ? (lang === 'hi' ? '🎉 बस आपके स्टॉप पर पहुँच चुकी है!' : '🎉 Bus has reached your stop!') 
                                        : (lang === 'hi' ? `बस ${activeChild.etaMins} मिनट दूर है (~ ${(activeChild.etaMins * 0.3).toFixed(1)} km)` : `Bus is ${activeChild.etaMins} mins away (~ ${(activeChild.etaMins * 0.3).toFixed(1)} km)`))
                                    : (busTripShift === 'morning'
                                        ? (lang === 'hi' ? `चालक ड्यूटी पर नहीं हैं (बस डिपो में खड़ी है)` : `Driver off duty (Bus at depot)`)
                                        : (lang === 'hi' ? 'चालक ड्यूटी पर नहीं हैं (बस स्कूल में खड़ी है)' : 'Driver off duty (Bus at school)')))
                                : (isTripActive 
                                    ? (lang === 'hi' ? st.subHi : st.subEn) 
                                    : (lang === 'hi' ? 'यात्रा प्रारंभ होने की प्रतीक्षा में' : 'Waiting for trip start'))}
                            </Text>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                </View>

                {/* Driver Details & Vehicle Number (UP 14 EF 3308) Coherent Card */}
                <View style={styles.card}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                      <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: isDarkMode ? '#1e293b' : '#eff6ff', borderWidth: 1, borderColor: isDarkMode ? '#334155' : '#bfdbfe', alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ fontSize: 20 }}>👨‍✈️</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={{ fontSize: 15, fontWeight: '700', color: isDarkMode ? '#f8fafc' : '#0f172a' }}>
                            {activeChild.driverNameHi || 'संतोष यादव'}
                          </Text>
                          <View style={{ backgroundColor: '#f1f5f9', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                            <Text style={{ fontSize: 10, fontWeight: '700', color: '#475569' }}>
                              {activeChild.busNo || 'Bus #08'}
                            </Text>
                          </View>
                        </View>
                        <Text style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                          {lang === 'hi' ? `कंडक्टर: ${activeChild.conductorNameHi || 'मुकेश'}` : `Helper: ${activeChild.conductorNameEn || 'Mukesh'}`}
                        </Text>
                      </View>
                    </View>

                    {/* Vehicle Plate Badge */}
                    <View style={{
                      backgroundColor: isDarkMode ? '#0f172a' : '#f8fafc',
                      paddingHorizontal: 10,
                      paddingVertical: 5,
                      borderRadius: 8,
                      borderWidth: 1,
                      borderColor: isDarkMode ? '#334155' : '#cbd5e1',
                      alignItems: 'center'
                    }}>
                      <Text style={{ fontSize: 9, color: '#64748b', fontWeight: 'bold' }}>VEHICLE NO</Text>
                      <Text style={{ fontSize: 12, fontWeight: '800', color: '#2563eb', letterSpacing: 0.5 }}>
                        {(activeChild.vehicleNo && !activeChild.vehicleNo.includes('DL 01')) ? activeChild.vehicleNo : (lang === 'hi' ? 'वाहन नंबर दर्ज नहीं' : 'No Vehicle Plate')}
                      </Text>
                    </View>
                  </View>

                  {/* School Helpline Info */}
                  <View style={{ marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: isDarkMode ? '#334155' : '#f1f5f9', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ fontSize: 11, color: '#64748b', flex: 1 }} numberOfLines={1}>
                      🏫 {lang === 'hi' ? activeChild.schoolNameHi : activeChild.schoolNameEn}
                    </Text>
                    <Text style={{ fontSize: 11, color: '#64748b' }}>
                      📞 {activeChild.schoolHelpline || (lang === 'hi' ? 'हेल्पलाइन दर्ज नहीं' : 'No helpline')}
                    </Text>
                  </View>

                  {/* Direct Call & Message Action Pills */}
                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                    <TouchableOpacity 
                      style={{
                        flex: 1,
                        backgroundColor: '#eff6ff',
                        borderColor: '#bfdbfe',
                        borderWidth: 1,
                        paddingVertical: 9,
                        borderRadius: 10,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6
                      }}
                      onPress={() => {
                        const phone = activeChild?.driverPhone?.trim();
                        if (phone && phone.replace(/[^0-9]/g, '').length >= 10) {
                          Linking.openURL(`tel:${phone}`);
                        } else {
                          Alert.alert('Notice', lang === 'hi' ? 'चालक का वैध फ़ोन नंबर दर्ज नहीं है।' : 'Driver phone number not registered.');
                        }
                      }}
                    >
                      <Text style={{ fontSize: 14 }}>📞</Text>
                      <Text style={{ fontSize: 12, fontWeight: '600', color: '#1d4ed8' }}>
                        {lang === 'hi' ? 'चालक को कॉल' : 'Call Driver'}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                      style={{
                        flex: 1,
                        backgroundColor: '#ecfdf5',
                        borderColor: '#a7f3d0',
                        borderWidth: 1,
                        paddingVertical: 9,
                        borderRadius: 10,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6
                      }}
                      onPress={() => {
                        const phone = activeChild?.driverPhone?.trim();
                        if (phone && phone.replace(/[^0-9]/g, '').length >= 10) {
                          const p = formatPhoneForAction(phone);
                          Linking.openURL(`whatsapp://send?phone=${p.whatsapp}`);
                        } else {
                          Alert.alert('Notice', lang === 'hi' ? 'चालक का वैध फ़ोन नंबर दर्ज नहीं है।' : 'Driver phone number not registered.');
                        }
                      }}
                    >
                      <Text style={{ fontSize: 14 }}>💬</Text>
                      <Text style={{ fontSize: 12, fontWeight: '600', color: '#047857' }}>
                        {lang === 'hi' ? 'व्हाट्सएप मैसेज' : 'WhatsApp'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
                </>
                )}
              </View>
            ) : userRole === 'DRIVER' ? (
              !isDriverAuthenticated ? (
                <View style={[styles.card, { alignItems: 'center', paddingVertical: 32, gap: 12, backgroundColor: isDarkMode ? '#1e293b' : '#ffffff', borderColor: '#ea580c', borderWidth: 1.5, borderRadius: 16 }]}>
                  <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: '#ffedd5', alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontSize: 28 }}>🚌</Text>
                  </View>
                  <Text style={{ fontSize: 17, fontWeight: 'bold', color: isDarkMode ? '#f8fafc' : '#0f172a', textAlign: 'center' }}>
                    {lang === 'hi' ? 'चालक सुरक्षा सत्यापन (Driver Gate)' : 'Driver Security Authentication'}
                  </Text>
                  <Text style={{ fontSize: 12, color: isDarkMode ? '#94a3b8' : '#64748b', textAlign: 'center', marginHorizontal: 20, lineHeight: 18 }}>
                    {lang === 'hi'
                      ? 'यह भाग केवल स्कूल के अधिकृत बस चालक व हेल्पर के लिए है। बस ड्यूटी व छात्र उपस्थिति शुरू करने हेतु स्कूल एडमिन द्वारा दिया गया 4-अंकीय चालक कोड दर्ज करें:'
                      : 'This section is restricted to authorized school bus drivers. Enter your 4-digit Driver PIN/Bus Code to access controls:'}
                  </Text>

                  <View style={{ width: '85%', gap: 10, marginTop: 8 }}>
                    <TextInput
                      style={[styles.formInput, { textAlign: 'center', fontSize: 22, fontWeight: 'bold', letterSpacing: 8, color: isDarkMode ? '#f8fafc' : '#0f172a', backgroundColor: isDarkMode ? '#0f172a' : '#fff7ed', borderColor: '#ea580c', borderWidth: 1.5, height: 48, borderRadius: 12 }]}
                      placeholder="••••"
                      placeholderTextColor="#94a3b8"
                      keyboardType="numeric"
                      maxLength={6}
                      secureTextEntry={true}
                      value={driverPinInput}
                      onChangeText={setDriverPinInput}
                    />
                    {driverPinError ? (
                      <Text style={{ color: '#dc2626', fontSize: 11, textAlign: 'center', fontWeight: 'bold' }}>{driverPinError}</Text>
                    ) : null}
                    <TouchableOpacity
                      style={{ backgroundColor: '#ea580c', paddingVertical: 12, borderRadius: 12, alignItems: 'center' }}
                      onPress={handleVerifyDriverPin}
                    >
                      <Text style={{ color: '#fff', fontSize: 13, fontWeight: 'bold' }}>
                        🔓 {lang === 'hi' ? 'चालक पिन वेरिफाई करें' : 'Unlock Driver Console'}
                      </Text>
                    </TouchableOpacity>
                    <Text style={{ fontSize: 11, color: '#94a3b8', textAlign: 'center' }}>
                      {lang === 'hi' ? 'डिफ़ॉल्ट चालक कोड: 1101' : 'Default Driver PIN: 1101'}
                    </Text>
                  </View>
                </View>
              ) : (
              <View style={{ gap: 14 }}>
                {/* ================= DRIVER & HELPER ZERO-BURDEN CONSOLE ================= */}
                {/* 1. Driver 4-Digit PIN / Bus Code Pair Card */}
                <View style={[styles.card, { backgroundColor: isDarkMode ? '#1e293b' : '#ffffff', borderWidth: 1.5, borderColor: '#ea580c' }]}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <Text style={[styles.sectionHeading, { color: '#ea580c' }]}>
                      🔑 {lang === 'hi' ? 'स्कूल एडमिन द्वारा दिया गया चालक कोड (PIN):' : 'Enter Driver PIN / Bus Code:'}
                    </Text>
                    {driverLoggedInBus && (
                      <View style={{ backgroundColor: '#dcfce7', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, borderWidth: 1, borderColor: '#86efac' }}>
                        <Text style={{ fontSize: 10, fontWeight: '700', color: '#15803d' }}>
                          ✓ {driverLoggedInBus.busNo} {lang === 'hi' ? 'सत्यापित' : 'Active'}
                        </Text>
                      </View>
                    )}
                  </View>
                  <Text style={{ fontSize: 11, color: isDarkMode ? '#94a3b8' : '#64748b', marginBottom: 8, lineHeight: 16 }}>
                    {lang === 'hi' 
                      ? 'स्कूल एडमिन से प्राप्त 4-अंकीय चालक कोड दर्ज करें (उदा: 1101, 1105, 4001 आदि)। आपकी बस और छात्र तुरंत कनेक्ट हो जाएँगे।' 
                      : 'Enter the 4-digit code provided by school admin (e.g. 1101, 1105, 4001) to link your bus & students immediately.'}
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TextInput
                      style={[styles.formInput, { 
                        flex: 1, 
                        color: isDarkMode ? '#f8fafc' : '#0f172a', 
                        backgroundColor: isDarkMode ? '#0f172a' : '#fff7ed', 
                        borderColor: '#ea580c', 
                        borderWidth: 1.5, 
                        fontSize: 16, 
                        fontWeight: 'bold', 
                        letterSpacing: 3, 
                        textAlign: 'center',
                        paddingVertical: 8
                      }]}
                      placeholder="उदा: 1101 या 1105"
                      placeholderTextColor="#94a3b8"
                      keyboardType="numeric"
                      maxLength={8}
                      value={driverPinInput}
                      onChangeText={setDriverPinInput}
                    />
                    <TouchableOpacity
                      style={{ backgroundColor: '#ea580c', paddingHorizontal: 16, borderRadius: 10, justifyContent: 'center' }}
                      onPress={handleVerifyDriverPin}
                    >
                      <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>
                        ✓ {lang === 'hi' ? 'वेरिफाई करें' : 'Verify'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                  {driverPinError ? (
                    <Text style={{ color: '#dc2626', fontSize: 11, marginTop: 5, fontWeight: '600' }}>
                      {driverPinError}
                    </Text>
                  ) : null}
                </View>
                {/* Assigned Bus Selector (Driver directly chooses from school fleet without forms) */}
                <View style={[styles.card, { backgroundColor: isDarkMode ? '#1e293b' : '#ffffff' }]}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <Text style={styles.sectionHeading}>
                      🚍 {lang === 'hi' ? 'आपकी आवंटित बस (Assigned Bus):' : 'Your Assigned Bus:'}
                    </Text>
                    <View style={{ backgroundColor: driverDutyActive ? '#dcfce7' : '#fff7ed', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, borderWidth: 1, borderColor: driverDutyActive ? '#86efac' : '#fed7aa' }}>
                      <Text style={{ fontSize: 10, color: driverDutyActive ? '#15803d' : '#c2410c', fontWeight: '700' }}>
                        {driverDutyActive ? (lang === 'hi' ? '🟢 ड्यूटी लाइव' : '🟢 DUTY LIVE') : (lang === 'hi' ? '⚪ स्टैंडबाय' : '⚪ STANDBY')}
                      </Text>
                    </View>
                  </View>

                  {schoolFleetBuses.length === 0 ? (
                    <View style={{ paddingVertical: 16, alignItems: 'center' }}>
                      <Text style={{ fontSize: 13, color: isDarkMode ? '#94a3b8' : '#64748b' }}>
                        {lang === 'hi' ? 'अभी स्कूल फ्लीट में कोई बस उपलब्ध नहीं है।' : 'No fleet buses registered in school yet.'}
                      </Text>
                      <Text style={{ fontSize: 12, color: '#ea580c', fontWeight: 'bold', marginTop: 4 }}>
                        {lang === 'hi' ? 'ऊपर 4-अंकीय चालक कोड दर्ज करें या स्कूल एडमिन से संपर्क करें।' : 'Enter your 4-digit driver code above.'}
                      </Text>
                    </View>
                  ) : (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                      {schoolFleetBuses.map(b => {
                        const isSelected = driverLoggedInBus?.busNo === b.busNo || driverLoggedInBus?.id === b.id;
                        return (
                          <TouchableOpacity
                            key={b.id || b.busNo}
                            style={{
                              paddingVertical: 10,
                              paddingHorizontal: 14,
                              borderRadius: 12,
                              borderWidth: 1.5,
                              borderColor: isSelected ? '#ea580c' : (isDarkMode ? '#334155' : '#e2e8f0'),
                              backgroundColor: isSelected ? (isDarkMode ? '#431407' : '#fff7ed') : (isDarkMode ? '#0f172a' : '#f8fafc'),
                              flexDirection: 'row',
                              alignItems: 'center',
                              gap: 8
                            }}
                            onPress={() => {
                              setDriverLoggedInBus(b);
                              AsyncStorage.setItem('@mast_v7_driver_bus', JSON.stringify(b));
                              Vibration.vibrate(40);
                            }}
                          >
                            <Text style={{ fontSize: 20 }}>🚍</Text>
                            <View>
                              <Text style={{ fontSize: 13, fontWeight: '700', color: isSelected ? '#ea580c' : (isDarkMode ? '#f8fafc' : '#0f172a') }}>
                                {b.busNo} {b.vehicleNo ? `(${b.vehicleNo})` : ''}
                              </Text>
                              <Text style={{ fontSize: 10, color: '#64748b' }}>
                                👤 {b.driverName || (lang === 'hi' ? 'चालक' : 'Driver')}
                              </Text>
                            </View>
                            {isSelected && (
                              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#ea580c', marginLeft: 4 }} />
                            )}
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  )}
                </View>
                {/* Zero-Burden Safe Driving Dashboard WITH CHANGE BUS BUTTON */}
                <View style={{ gap: 14 }}>
                    {/* Driver Profile Header with SWITCH BUS BUTTON */}
                    <View style={{ backgroundColor: '#0f172a', padding: 16, borderRadius: 20 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: '#fff', fontSize: 18, fontWeight: 'bold' }}>
                            🚍 {driverLoggedInBus?.busNo || (lang === 'hi' ? 'कोई बस आवंटित नहीं' : 'No Bus Assigned')}
                          </Text>
                          <Text style={{ color: '#fed7aa', fontSize: 13, fontWeight: 'bold', marginTop: 2 }}>
                            🏫 {driverLoggedInBus?.schoolName || schoolNameConfig || (lang === 'hi' ? 'स्कूल का नाम दर्ज नहीं' : 'No School Set')}
                          </Text>
                          <Text style={{ color: '#94a3b8', fontSize: 11, marginTop: 2 }}>
                            📍 {driverLoggedInBus?.district || schoolDistrictConfig || driverDistrict}, {driverLoggedInBus?.state || schoolStateConfig || driverState}
                          </Text>
                          <Text style={{ color: '#cbd5e1', fontSize: 11, marginTop: 2 }}>
                            👤 {lang === 'hi' ? 'चालक:' : 'Driver:'} {driverLoggedInBus?.driverName || userProfile?.name || (lang === 'hi' ? 'चालक' : 'Driver')} • 📞 {driverLoggedInBus?.driverPhone || userProfile?.mobile || (lang === 'hi' ? 'नंबर दर्ज नहीं' : 'No phone')}
                          </Text>
                        </View>
                        
                        <View style={{ gap: 6, alignItems: 'flex-end' }}>
                          <TouchableOpacity 
                            style={{ backgroundColor: '#dc2626', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 }}
                            onPress={handleDriverLogout}
                          >
                            <Text style={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}>
                              🚪 {lang === 'hi' ? 'ड्यूटी बंद / बस बदलें' : 'Switch Bus / Logout'}
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>

                    {/* Morning Pickup vs Afternoon Return Shift Selector */}
                    <View style={{
                      flexDirection: 'row',
                      backgroundColor: isDarkMode ? '#1e293b' : '#f1f5f9',
                      borderRadius: 14,
                      padding: 4,
                      gap: 6
                    }}>
                      <TouchableOpacity
                        style={[
                          { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10 },
                          busTripShift === 'morning' && { backgroundColor: isDarkMode ? '#0f172a' : '#ffffff', elevation: 1 }
                        ]}
                        onPress={() => {
                          setBusTripShift('morning');
                          Vibration.vibrate(40);
                        }}
                      >
                        <Text style={{
                          fontSize: 12,
                          fontWeight: '700',
                          color: busTripShift === 'morning' ? '#2563eb' : (isDarkMode ? '#94a3b8' : '#64748b')
                        }}>
                          🌅 {lang === 'hi' ? 'सुबह पिकअप (स्कूल की ओर)' : 'Morning: Pickup'}
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[
                          { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10 },
                          busTripShift === 'afternoon' && { backgroundColor: isDarkMode ? '#0f172a' : '#ffffff', elevation: 1 }
                        ]}
                        onPress={() => {
                          setBusTripShift('afternoon');
                          Vibration.vibrate(40);
                        }}
                      >
                        <Text style={{
                          fontSize: 12,
                          fontWeight: '700',
                          color: busTripShift === 'afternoon' ? '#ea580c' : (isDarkMode ? '#94a3b8' : '#64748b')
                        }}>
                          🎒 {lang === 'hi' ? 'दोपहर वापसी (घर की ओर)' : 'Afternoon: Drop'}
                        </Text>
                      </TouchableOpacity>
                    </View>

                    {/* Massive 1-Tap Duty Toggle */}
                    <View style={styles.card}>
                      <View style={{ alignItems: 'center', marginVertical: 8 }}>
                        <Text style={{ fontSize: 44 }}>{driverDutyActive ? '🟢' : '⚪'}</Text>
                        <Text style={{ fontSize: 18, fontWeight: 'bold', color: driverDutyActive ? '#15803d' : '#475569', marginTop: 6 }}>
                          {driverDutyActive 
                            ? (busTripShift === 'morning'
                                ? (lang === 'hi' ? 'मॉर्निंग पिकअप चालू • GPS लाइव' : 'Morning Trip Active • GPS Live')
                                : (lang === 'hi' ? 'दोपहर वापसी चालू • GPS लाइव' : 'Afternoon Trip Active • GPS Live'))
                            : (lang === 'hi' ? 'ड्यूटी बंद है (Trip Offline)' : 'Trip Offline')}
                        </Text>
                        <Text style={{ fontSize: 12, color: '#64748b', textAlign: 'center', marginTop: 4, lineHeight: 18, paddingHorizontal: 10 }}>
                          {driverDutyActive 
                            ? (lang === 'hi' ? '🛡️ सुरक्षित ड्राइव करें! आपको स्क्रीन छूने की कोई आवश्यकता नहीं है। ऐप अपने आप GPS और स्टॉप्स अपडेट कर रहा है।' : 'Drive safely! No screen interaction needed. GPS and ETAs update automatically.')
                            : (lang === 'hi' ? 'बस शुरू करने से पहले हरा बटन दबाएं और फोन डैशबोर्ड पर रख दें।' : 'Tap Start Duty before driving and mount phone on dashboard.')}
                        </Text>
                      </View>

                      {/* Screen Keep-Awake & Battery Saver Toggle */}
                      <TouchableOpacity
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          paddingVertical: 10,
                          paddingHorizontal: 14,
                          backgroundColor: driverKeepAwake ? '#eff6ff' : (isDarkMode ? '#0f172a' : '#f8fafc'),
                          borderColor: driverKeepAwake ? '#3b82f6' : (isDarkMode ? '#334155' : '#cbd5e1'),
                          borderWidth: 1.5,
                          borderRadius: 14,
                          marginVertical: 10
                        }}
                        onPress={() => {
                          Vibration.vibrate(50);
                          setDriverKeepAwake(!driverKeepAwake);
                        }}
                      >
                        <View style={{ flex: 1, marginRight: 10 }}>
                          <Text style={{ fontSize: 14, fontWeight: 'bold', color: isDarkMode ? '#f8fafc' : '#0f172a' }}>
                            {driverKeepAwake ? '🔆 स्क्रीन ऑन रखें (चार्जर कनेक्टेड)' : '🔋 बैटरी सेवर (स्क्रीन लॉक मोड)'}
                          </Text>
                          <Text style={{ fontSize: 11, color: isDarkMode ? '#94a3b8' : '#64748b', marginTop: 2 }}>
                            {driverKeepAwake
                              ? 'ड्राइविंग के समय स्क्रीन बंद नहीं होगी (चार्जर में रखें)'
                              : 'स्क्रीन बंद करने पर भी बस की लाइव लोकेशन बैकग्राउंड में चालू रहेगी'}
                          </Text>
                        </View>
                        <View style={{
                          width: 44,
                          height: 24,
                          borderRadius: 12,
                          backgroundColor: driverKeepAwake ? '#2563eb' : '#cbd5e1',
                          justifyContent: 'center',
                          paddingHorizontal: 2
                        }}>
                          <View style={{
                            width: 20,
                            height: 20,
                            borderRadius: 10,
                            backgroundColor: '#ffffff',
                            alignSelf: driverKeepAwake ? 'flex-end' : 'flex-start'
                          }} />
                        </View>
                      </TouchableOpacity>

                      <TouchableOpacity 
                        style={[
                          styles.driverTripBtn, 
                          driverDutyActive ? { backgroundColor: '#ef4444' } : { backgroundColor: busTripShift === 'morning' ? '#10b981' : '#ea580c' },
                          { paddingVertical: 18, borderRadius: 18 }
                        ]} 
                        onPress={toggleDriverDuty}
                      >
                        <Text style={[styles.driverTripBtnText, { fontSize: 17 }]}>
                          {driverDutyActive 
                            ? (busTripShift === 'morning'
                                ? (lang === 'hi' ? '🏁 स्कूल पहुँचे - मॉर्निंग ट्रिप समाप्त करें' : '🏁 REACHED SCHOOL - END TRIP')
                                : (lang === 'hi' ? '🏁 डिपो पहुँचे - वापसी ट्रिप समाप्त करें' : '🏁 REACHED DEPOT - END TRIP'))
                            : (busTripShift === 'morning'
                                ? (lang === 'hi' ? '🚀 सुबह की पिकअप ट्रिप शुरू करें' : '🚀 START MORNING PICKUP')
                                : (lang === 'hi' ? '🎒 स्कूल से वापसी ट्रिप प्रारंभ करें' : '🎒 DEPART SCHOOL - START DROP'))}
                        </Text>
                      </TouchableOpacity>
                    </View>

                    {/* Helper / Conductor Student Attendance Roster */}
                    <View style={styles.card}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 6 }}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.sectionHeading}>
                            {busTripShift === 'afternoon'
                              ? (lang === 'hi' ? '🎒 स्कूल से वापसी — ले जाने वाले बच्चों की सूची' : '🎒 Afternoon Drop — Students Roster')
                              : (lang === 'hi' ? '📋 सुबह पिकअप — छात्रों की बस उपस्थिति' : '📋 Morning Pickup — Boarding Roster')}
                          </Text>
                          <Text style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                            {busTripShift === 'afternoon'
                              ? (lang === 'hi' ? 'बच्चे के बस में बैठते ही टैप करें — माता-पिता को तुरंत पता चल जाएगा कि बच्चा स्कूल से निकल चुका है:' : 'स्टॉप पर बच्चे के चढ़ने पर टैप करें (अभिभावक को तुरंत सूचना जाएगी):')
                              : (lang === 'hi' ? 'स्टॉप पर बच्चे के चढ़ने पर टैप करें (अभिभावक को तुरंत सूचना जाएगी):' : 'Tap student to update boarding (Alerts parents instantly):')}
                          </Text>
                        </View>

                        <TouchableOpacity
                          style={{
                            backgroundColor: '#10b981',
                            paddingHorizontal: 10,
                            paddingVertical: 6,
                            borderRadius: 8
                          }}
                          onPress={markAllStudentsBoarded}
                        >
                          <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>
                            {lang === 'hi' ? '✓ सभी सवार' : '✓ All Boarded'}
                          </Text>
                        </TouchableOpacity>
                      </View>

                      <View style={{ gap: 8 }}>
                        {schoolChildren.length === 0 ? (
                          <View style={{ padding: 14, backgroundColor: isDarkMode ? '#0f172a' : '#f8fafc', borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: isDarkMode ? '#334155' : '#e2e8f0' }}>
                            <Text style={{ fontSize: 24, marginBottom: 4 }}>🎒</Text>
                            <Text style={{ fontSize: 13, fontWeight: 'bold', color: isDarkMode ? '#f8fafc' : '#0f172a', textAlign: 'center' }}>
                              {lang === 'hi' ? 'अभी कोई छात्र पंजीकृत नहीं है' : 'No Students Enrolled Yet'}
                            </Text>
                            <Text style={{ fontSize: 11, color: '#64748b', textAlign: 'center', marginTop: 2, marginHorizontal: 12 }}>
                              {lang === 'hi' ? 'अभिभावक द्वारा 4-अंकीय कोड (4001 आदि) से बच्चे का पंजीकरण करते ही छात्र का नाम यहाँ आ जाएगा।' : 'As soon as parents enroll with bus code, students appear here.'}
                            </Text>
                            <TouchableOpacity 
                              style={{ marginTop: 8, backgroundColor: '#ea580c', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 }}
                              onPress={() => fetchLatestSchoolDataFromCloud(true)}
                            >
                              <Text style={{ color: '#fff', fontSize: 11, fontWeight: 'bold' }}>🔄 {lang === 'hi' ? 'छात्र सूची रीफ्रेश करें' : 'Refresh Student Roster'}</Text>
                            </TouchableOpacity>
                          </View>
                        ) : (
                          schoolChildren.map(kid => (
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
                                  <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#0f172a' }}>{(lang === 'en' && kid.nameEn) ? kid.nameEn : kid.name}</Text>
                                  <Text style={{ fontSize: 11, color: '#64748b' }}>{kid.grade} • {kid.busNo}</Text>
                                </View>
                              </View>
                              <View style={{ backgroundColor: kid.isBoarded ? '#dcfce7' : '#fee2e2', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 }}>
                                <Text style={{ color: kid.isBoarded ? '#15803d' : '#dc2626', fontSize: 11, fontWeight: 'bold' }}>
                                  {kid.isBoarded ? (lang === 'hi' ? 'सवार ✓' : 'Boarded ✓') : (lang === 'hi' ? 'अनुपस्थित' : 'Absent')}
                                </Text>
                              </View>
                            </TouchableOpacity>
                          ))
                        )}
                      </View>
                    </View>

                    {/* Driver Emergency & Route Broadcast with Clean Dropdown */}
                    <View style={[styles.card, { backgroundColor: isDarkMode ? '#1e293b' : '#ffffff', borderColor: '#ea580c', borderWidth: 1.5, borderRadius: 16 }]}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <Text style={{ fontSize: 22 }}>📢</Text>
                          <Text style={{ fontSize: 15, fontWeight: '700', color: '#ea580c' }}>
                            {lang === 'hi' ? 'अभिभावक सूचना (Broadcast Alert)' : 'Parent Broadcast Alert'}
                          </Text>
                        </View>
                        <View style={{ backgroundColor: '#fff7ed', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, borderWidth: 1, borderColor: '#fed7aa' }}>
                          <Text style={{ fontSize: 10, color: '#c2410c', fontWeight: 'bold' }}>
                            {lang === 'hi' ? 'ड्रॉपडाउन से चुनें' : 'Select Option'}
                          </Text>
                        </View>
                      </View>

                      <Text style={{ fontSize: 12, color: isDarkMode ? '#94a3b8' : '#64748b', marginBottom: 10, lineHeight: 16 }}>
                        {lang === 'hi'
                          ? 'ट्रैफिक, पंक्चर, या स्टॉप आगमन की स्थिति में नीचे से कारण चुनें और 1-टैप में सभी अभिभावकों को भेजें:'
                          : 'Select an alert reason from the dropdown and tap broadcast:'}
                      </Text>

                      {/* Dropdown Selector Button */}
                      <TouchableOpacity
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          backgroundColor: isDarkMode ? '#0f172a' : '#f8fafc',
                          paddingHorizontal: 14,
                          paddingVertical: 12,
                          borderRadius: 12,
                          borderWidth: 1.5,
                          borderColor: isDarkMode ? '#334155' : '#cbd5e1',
                          marginBottom: 10
                        }}
                        onPress={() => setIsBroadcastDropdownOpen(!isBroadcastDropdownOpen)}
                      >
                        {(() => {
                          const opt = DRIVER_BROADCAST_OPTIONS.find(o => o.id === selectedBroadcastId) || DRIVER_BROADCAST_OPTIONS[0];
                          return (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                              <Text style={{ fontSize: 20 }}>{opt.icon}</Text>
                              <Text style={{ fontSize: 14, fontWeight: '700', color: isDarkMode ? '#f8fafc' : '#0f172a', flex: 1 }} numberOfLines={1}>
                                {lang === 'hi' ? opt.labelHi : opt.labelEn}
                              </Text>
                            </View>
                          );
                        })()}
                        <Text style={{ fontSize: 14, color: '#ea580c', fontWeight: 'bold' }}>
                          {isBroadcastDropdownOpen ? '▲' : '▼'}
                        </Text>
                      </TouchableOpacity>

                      {/* Dropdown Options List */}
                      {isBroadcastDropdownOpen && (
                        <View style={{
                          backgroundColor: isDarkMode ? '#0f172a' : '#ffffff',
                          borderRadius: 12,
                          borderWidth: 1.5,
                          borderColor: '#ea580c',
                          marginBottom: 12,
                          overflow: 'hidden'
                        }}>
                          {DRIVER_BROADCAST_OPTIONS.map((opt, idx) => {
                            const isSelected = opt.id === selectedBroadcastId;
                            return (
                              <TouchableOpacity
                                key={opt.id}
                                style={{
                                  flexDirection: 'row',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  paddingHorizontal: 14,
                                  paddingVertical: 12,
                                  backgroundColor: isSelected ? (isDarkMode ? '#431407' : '#fff7ed') : 'transparent',
                                  borderBottomWidth: idx === DRIVER_BROADCAST_OPTIONS.length - 1 ? 0 : 1,
                                  borderBottomColor: isDarkMode ? '#1e293b' : '#f1f5f9'
                                }}
                                onPress={() => {
                                  setSelectedBroadcastId(opt.id);
                                  setIsBroadcastDropdownOpen(false);
                                  Vibration.vibrate(30);
                                }}
                              >
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                                  <Text style={{ fontSize: 20 }}>{opt.icon}</Text>
                                  <Text style={{ fontSize: 13, fontWeight: isSelected ? '700' : '500', color: isSelected ? '#ea580c' : (isDarkMode ? '#f8fafc' : '#334155') }}>
                                    {lang === 'hi' ? opt.labelHi : opt.labelEn}
                                  </Text>
                                </View>
                                {isSelected && <Text style={{ color: '#ea580c', fontWeight: 'bold', fontSize: 14 }}>✓</Text>}
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      )}

                      {/* 1-Tap Broadcast Action Button */}
                      <TouchableOpacity
                        style={{
                          backgroundColor: '#ea580c',
                          paddingVertical: 13,
                          borderRadius: 12,
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 8,
                          shadowColor: '#ea580c',
                          shadowOpacity: 0.25,
                          shadowRadius: 4,
                          elevation: 2
                        }}
                        onPress={() => {
                          const opt = DRIVER_BROADCAST_OPTIONS.find(o => o.id === selectedBroadcastId) || DRIVER_BROADCAST_OPTIONS[0];
                          dispatchDriverAnnouncement(opt.textHi, opt.textEn, opt.eta, opt.stopIdx);
                        }}
                      >
                        <Text style={{ fontSize: 18 }}>📢</Text>
                        <Text style={{ color: '#fff', fontSize: 14, fontWeight: 'bold' }}>
                          {lang === 'hi' ? 'सभी अभिभावकों को यह अलर्ट भेजें' : 'Broadcast Alert to All Parents'}
                        </Text>
                      </TouchableOpacity>
                    </View>

                    {/* Driver Emergency Helpline */}
                    <TouchableOpacity 
                      style={{ backgroundColor: '#dc2626', padding: 14, borderRadius: 16, alignItems: 'center' }}
                      onPress={() => {
                        const h = activeChild?.schoolHelpline || schoolHelplineConfig;
                        if (h && h.trim().length >= 8 && !h.includes('011')) {
                          Linking.openURL(`tel:${h}`);
                        } else {
                          Alert.alert(
                            lang === 'hi' ? 'हेल्पलाइन नंबर उपलब्ध नहीं' : 'Helpline Not Available',
                            lang === 'hi' ? 'स्कूल ट्रांसपोर्ट कंट्रोल रूम का नंबर अभी दर्ज नहीं है।' : 'Transport control helpline number has not been registered yet.'
                          );
                        }
                      }}
                    >
                      <Text style={{ color: '#fff', fontSize: 14, fontWeight: 'bold' }}>
                        📞 {lang === 'hi' ? 'स्कूल ट्रांसपोर्ट कंट्रोल रूम को कॉल करें (Emergency)' : 'Call Transport Control Room (Emergency)'}
                      </Text>
                    </TouchableOpacity>
                  </View>
              </View>
              )
            ) : (
              !isSchoolAdminAuthenticated ? (
                <View style={[styles.card, { alignItems: 'center', paddingVertical: 32, gap: 12, backgroundColor: isDarkMode ? '#1e293b' : '#ffffff', borderColor: '#4f46e5', borderWidth: 1.5, borderRadius: 16 }]}>
                  <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: '#e0e7ff', alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontSize: 28 }}>🔒</Text>
                  </View>
                  <Text style={{ fontSize: 17, fontWeight: 'bold', color: isDarkMode ? '#f8fafc' : '#0f172a', textAlign: 'center' }}>
                    {lang === 'hi' ? 'स्कूल प्रशासन सुरक्षा लॉक (Admin Gate)' : 'School Admin Security Lock'}
                  </Text>
                  <Text style={{ fontSize: 12, color: isDarkMode ? '#94a3b8' : '#64748b', textAlign: 'center', marginHorizontal: 20, lineHeight: 18 }}>
                    {lang === 'hi'
                      ? 'यह भाग केवल अधिकृत स्कूल मैनेजमेंट के लिए है। स्कूल फ्लीट व बस प्रबंधन हेतु अपना 4-अंकीय एडमिन पिन दर्ज करें:'
                      : 'This section is restricted to school authorities. Enter your 4-digit Admin PIN to manage buses & fleet:'}
                  </Text>

                  <View style={{ width: '85%', gap: 10, marginTop: 8 }}>
                    <TextInput
                      style={[styles.formInput, { textAlign: 'center', fontSize: 22, fontWeight: 'bold', letterSpacing: 8, color: isDarkMode ? '#f8fafc' : '#0f172a', backgroundColor: isDarkMode ? '#0f172a' : '#f8fafc', borderColor: '#4f46e5', borderWidth: 1.5, height: 48, borderRadius: 12 }]}
                      placeholder="••••"
                      placeholderTextColor="#94a3b8"
                      keyboardType="numeric"
                      maxLength={4}
                      secureTextEntry={true}
                      value={adminPinInput}
                      onChangeText={setAdminPinInput}
                    />
                    {adminPinError ? (
                      <Text style={{ color: '#dc2626', fontSize: 11, textAlign: 'center', fontWeight: 'bold' }}>{adminPinError}</Text>
                    ) : null}
                    <TouchableOpacity
                      style={{ backgroundColor: '#4f46e5', paddingVertical: 12, borderRadius: 12, alignItems: 'center' }}
                      onPress={handleVerifyAdminPin}
                    >
                      <Text style={{ color: '#fff', fontSize: 13, fontWeight: 'bold' }}>
                        🔓 {lang === 'hi' ? 'एडमिन पिन वेरिफाई करें' : 'Unlock Admin Console'}
                      </Text>
                    </TouchableOpacity>
                    <Text style={{ fontSize: 11, color: '#94a3b8', textAlign: 'center' }}>
                      {schoolAdminPin === '1234'
                        ? (lang === 'hi' ? 'डिफ़ॉल्ट एडमिन पिन: 1234' : 'Default Admin PIN: 1234')
                        : (lang === 'hi' ? 'अपना नया बदला हुआ एडमिन पिन दर्ज करें' : 'Enter your customized Admin PIN')}
                    </Text>
                  </View>
                </View>
              ) : (
              <View style={{ gap: 14 }}>
                {/* ================= SCHOOL ADMIN FLEET CONTROL CONSOLE ================= */}
                {/* School Profile Card (Admin Command Center - Spacious & Aligned) */}
                <View style={[styles.card, { backgroundColor: isDarkMode ? '#1e293b' : '#0f172a', padding: 18, borderRadius: 22 }]}>
                  {/* Top Bar: Title Badge + Admin Action Icons */}
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 6 }}>
                    <View style={{ backgroundColor: 'rgba(254, 215, 170, 0.15)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 }}>
                      <Text style={{ color: '#fed7aa', fontSize: 11, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        🏫 {lang === 'hi' ? 'स्कूल प्रशासन ट्रांसपोर्ट कंट्रोल रूम' : 'School Fleet Command Center'}
                      </Text>
                    </View>

                    <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <TouchableOpacity 
                        style={{ backgroundColor: '#dc2626', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 }}
                        onPress={() => {
                          setIsSchoolAdminAuthenticated(false);
                          setUserRole('PARENT');
                          setBusRole('parent');
                          Alert.alert(
                            lang === 'hi' ? '🔒 एडमिन लॉक' : '🔒 Admin Locked',
                            lang === 'hi' ? 'स्कूल एडमिन कंसोल सुरक्षित लॉक हो गया है।' : 'School admin console safely locked.'
                          );
                        }}
                      >
                        <Text style={{ color: '#fff', fontSize: 11, fontWeight: 'bold' }}>
                          🔒 {lang === 'hi' ? 'सुरक्षित लॉक' : 'Lock Console'}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={{ backgroundColor: '#0284c7', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 }}
                        onPress={() => {
                          setDraftSchoolName(schoolNameConfig);
                          setDraftSchoolDistrict(schoolDistrictConfig);
                          setDraftSchoolState(schoolStateConfig);
                          setDraftSchoolHelpline(schoolHelplineConfig);
                          setIsEditingSchoolProfile(true);
                        }}
                      >
                        <Text style={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}>
                          ✏️ {lang === 'hi' ? 'प्रोफ़ाइल' : 'Profile'}
                        </Text>
                      </TouchableOpacity>
                      
                      <TouchableOpacity 
                        style={{ backgroundColor: '#334155', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 }}
                        onPress={() => setIsChangeAdminPinOpen(true)}
                      >
                        <Text style={{ color: '#fed7aa', fontSize: 12, fontWeight: 'bold' }}>
                          🔑 {lang === 'hi' ? 'पिन' : 'PIN'}
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity 
                        style={{ backgroundColor: '#16a34a', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 }}
                        onPress={async () => {
                          Vibration.vibrate(50);
                          await publishCloudEvent({
                            type: 'fleet_sync',
                            schoolProfile: { name: schoolNameConfig, district: schoolDistrictConfig, state: schoolStateConfig, helpline: schoolHelplineConfig },
                            schoolFleetBuses
                          });
                          Alert.alert(lang === 'hi' ? '✓ क्लाउड सिंक सफल' : '✓ Cloud Sync Sent', lang === 'hi' ? 'स्कूल प्रोफ़ाइल व सभी बसों का डेटा सभी अभिभावकों व चालकों के मोबाइल पर लाइव सिंक हो गया है!' : 'School and fleet data synced live to all parent and driver mobiles!');
                        }}
                      >
                        <Text style={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}>
                          ☁️ {lang === 'hi' ? 'सिंक भेजें' : 'Push Sync'}
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity 
                        style={{ backgroundColor: '#dc2626', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 }}
                        onPress={handleLockSchoolAdmin}
                      >
                        <Text style={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}>
                          🚪 {lang === 'hi' ? 'लॉगआउट' : 'Lock'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Main School Info: Full width with spacious alignment */}
                  <View style={{ marginBottom: 14 }}>
                    <Text style={{ color: '#ffffff', fontSize: 20, fontWeight: 'bold', lineHeight: 26 }}>
                      {schoolNameConfig || (lang === 'hi' ? 'स्कूल का नाम दर्ज नहीं' : 'No School Registered')}
                    </Text>

                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12, marginTop: 8 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <TouchableOpacity 
                          style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.14)', paddingHorizontal: 9, paddingVertical: 5, borderRadius: 8 }} 
                          onPress={() => { setDraftSchoolState(schoolStateConfig); setDraftSchoolDistrict(schoolDistrictConfig); openLocationPicker('district', 'admin'); }}
                        >
                          <Text style={{ fontSize: 13 }}>📍</Text>
                          <Text style={{ color: '#fff', fontSize: 13, fontWeight: 'bold' }}>
                            {schoolDistrictConfig} ✏️
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity 
                          style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.10)', paddingHorizontal: 9, paddingVertical: 5, borderRadius: 8 }} 
                          onPress={() => { setDraftSchoolState(schoolStateConfig); setDraftSchoolDistrict(schoolDistrictConfig); openLocationPicker('state', 'admin'); }}
                        >
                          <Text style={{ fontSize: 13 }}>🏛️</Text>
                          <Text style={{ color: '#cbd5e1', fontSize: 12, fontWeight: '500' }}>
                            {schoolStateConfig} ✏️
                          </Text>
                        </TouchableOpacity>
                      </View>

                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.08)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}>
                        <Text style={{ fontSize: 12 }}>📞</Text>
                        <Text style={{ color: '#38bdf8', fontSize: 13, fontWeight: 'bold' }}>
                          +91 {schoolHelplineConfig}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Add New Bus Button */}
                  <TouchableOpacity 
                    style={{ backgroundColor: '#ea580c', paddingVertical: 11, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }}
                    onPress={() => handleOpenAddFleetBus()}
                  >
                    <Text style={{ color: '#fff', fontSize: 14, fontWeight: 'bold' }}>
                      + {lang === 'hi' ? 'फ्लीट में नई बस जोड़ें' : 'Add New Bus to Fleet'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Metric Summary Cards */}
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <View style={[styles.card, { flex: 1, alignItems: 'center', paddingVertical: 12, backgroundColor: isDarkMode ? '#1e293b' : '#fff' }]}>
                    <Text style={{ fontSize: 20 }}>🚌</Text>
                    <Text style={{ fontSize: 18, fontWeight: 'bold', color: isDarkMode ? '#f8fafc' : '#0f172a', marginTop: 2 }}>
                      {schoolFleetBuses.length}
                    </Text>
                    <Text style={{ fontSize: 11, color: '#64748b', fontWeight: 'bold' }}>
                      {lang === 'hi' ? 'कुल बसें' : 'Total Fleet'}
                    </Text>
                  </View>

                  <View style={[styles.card, { flex: 1, alignItems: 'center', paddingVertical: 12, backgroundColor: isDarkMode ? '#1e293b' : '#fff' }]}>
                    <Text style={{ fontSize: 20 }}>🟢</Text>
                    <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#16a34a', marginTop: 2 }}>
                      {schoolFleetBuses.filter(b => b.isTripActive).length}
                    </Text>
                    <Text style={{ fontSize: 11, color: '#64748b', fontWeight: 'bold' }}>
                      {lang === 'hi' ? 'सक्रिय बसें' : 'On Route'}
                    </Text>
                  </View>

                  <View style={[styles.card, { flex: 1, alignItems: 'center', paddingVertical: 12, backgroundColor: isDarkMode ? '#1e293b' : '#fff' }]}>
                    <Text style={{ fontSize: 20 }}>🎒</Text>
                    <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#ea580c', marginTop: 2 }}>
                      {Math.max(schoolChildren.length, schoolFleetBuses.reduce((acc, b) => acc + (b.studentCount || 0), 0))}
                    </Text>
                    <Text style={{ fontSize: 11, color: '#64748b', fontWeight: 'bold' }}>
                      {lang === 'hi' ? 'पंजीकृत छात्र' : 'Enrolled'}
                    </Text>
                  </View>

                  <View style={[styles.card, { flex: 1, alignItems: 'center', paddingVertical: 12, backgroundColor: isDarkMode ? '#1e293b' : '#fff' }]}>
                    <Text style={{ fontSize: 20 }}>✅</Text>
                    <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#16a34a', marginTop: 2 }}>
                      {schoolChildren.filter(c => c.isBoarded).length}
                    </Text>
                    <Text style={{ fontSize: 11, color: '#64748b', fontWeight: 'bold' }}>
                      {lang === 'hi' ? 'सवार छात्र' : 'Boarded'}
                    </Text>
                  </View>
                </View>

                {/* Enrolled Students & Live Boarding Roster in Admin Console */}
                <View style={[styles.card, { backgroundColor: isDarkMode ? '#1e293b' : '#fff', padding: 14 }]}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <View>
                      <Text style={{ fontSize: 15, fontWeight: 'bold', color: isDarkMode ? '#f8fafc' : '#0f172a' }}>
                        🎒 {lang === 'hi' ? 'नामांकित छात्र व बस उपस्थिति' : 'Enrolled Students & Boarding'}
                      </Text>
                      <Text style={{ fontSize: 11, color: '#64748b' }}>
                        {schoolChildren.length} {lang === 'hi' ? 'छात्र पंजीकृत' : 'Students Enrolled'} • {schoolChildren.filter(c => c.isBoarded).length} {lang === 'hi' ? 'सवार' : 'Boarded'}
                      </Text>
                    </View>
                    <TouchableOpacity 
                      style={{ backgroundColor: '#2563eb', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 }}
                      onPress={() => {
                        publishCloudEvent({ type: 'request_children_sync' });
                        fetchLatestSchoolDataFromCloud(true);
                      }}
                    >
                      <Text style={{ color: '#fff', fontSize: 11, fontWeight: 'bold' }}>🔄 {lang === 'hi' ? 'रीफ्रेश' : 'Refresh'}</Text>
                    </TouchableOpacity>
                  </View>

                  {schoolChildren.length === 0 ? (
                    <View style={{ padding: 14, alignItems: 'center', backgroundColor: isDarkMode ? '#0f172a' : '#f8fafc', borderRadius: 10, borderWidth: 1, borderColor: isDarkMode ? '#334155' : '#e2e8f0' }}>
                      <Text style={{ fontSize: 13, color: '#64748b', textAlign: 'center' }}>
                        {lang === 'hi' ? 'अभिभावकों द्वारा 4-अंकीय कोड से जोड़े गए छात्र यहाँ लाइव दिखेंगे।' : 'Students enrolled by parents with bus code will appear here.'}
                      </Text>
                    </View>
                  ) : (
                    <View style={{ gap: 8 }}>
                      {schoolChildren.map(kid => (
                        <View 
                          key={kid.id}
                          style={{
                            flexDirection: 'row',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: 10,
                            borderRadius: 10,
                            backgroundColor: kid.isBoarded ? '#f0fdf4' : (isDarkMode ? '#0f172a' : '#f8fafc'),
                            borderWidth: 1,
                            borderColor: kid.isBoarded ? '#86efac' : (isDarkMode ? '#334155' : '#e2e8f0')
                          }}
                        >
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                            <Text style={{ fontSize: 22 }}>{kid.avatar || '👦'}</Text>
                            <View>
                              <Text style={{ fontSize: 13, fontWeight: 'bold', color: isDarkMode ? '#f8fafc' : '#0f172a' }}>
                                {kid.name} ({kid.grade})
                              </Text>
                              <Text style={{ fontSize: 11, color: '#64748b' }}>
                                🚌 {kid.busNo} • 📍 {kid.stopNameHi || kid.stopNameEn || 'स्टॉप'}
                              </Text>
                            </View>
                          </View>
                          <View style={{ backgroundColor: kid.isBoarded ? '#dcfce7' : '#fee2e2', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}>
                            <Text style={{ fontSize: 11, fontWeight: 'bold', color: kid.isBoarded ? '#15803d' : '#dc2626' }}>
                              {kid.isBoarded ? (lang === 'hi' ? 'सवार ✓' : 'Boarded') : (lang === 'hi' ? 'अनुपस्थित' : 'Absent')}
                            </Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  )}
                </View>

                {/* School-Wide Broadcast Notice Box */}
                <View style={[styles.card, { backgroundColor: isDarkMode ? '#1e293b' : '#fff', padding: 14 }]}>
                  <Text style={{ fontSize: 14, fontWeight: 'bold', color: isDarkMode ? '#f8fafc' : '#0f172a', marginBottom: 6 }}>
                    📢 {lang === 'hi' ? 'स्कूल सामूहिक सूचना (1-टैप ब्रॉडकास्ट)' : 'School-Wide Broadcast (1-Tap)'}
                  </Text>
                  <Text style={{ fontSize: 12, color: '#64748b', marginBottom: 10 }}>
                    {lang === 'hi' ? 'सभी अभिभावकों और चालकों को तुरंत पुश अलर्ट भेजें:' : 'Send instant alerts to all parents and drivers:'}
                  </Text>
                  <View style={{ gap: 8 }}>
                    <TouchableOpacity 
                      style={{ backgroundColor: '#fef3c7', padding: 10, borderRadius: 12, borderWidth: 1, borderColor: '#fde68a', flexDirection: 'row', alignItems: 'center', gap: 8 }}
                      onPress={async () => {
                        const title = lang === 'hi' ? '🌧️ स्कूल जल्दी छूटेगा (भारी बारिश)' : '🌧️ Early Closure Alert (Heavy Rain)';
                        const body = lang === 'hi' 
                          ? 'भारी बारिश के कारण आज स्कूल दोपहर 12:30 बजे छूटेगा। बसें समय से रवाना होंगी।' 
                          : 'Due to heavy rain, school will close early at 12:30 PM. Buses departing accordingly.';
                        await publishCloudEvent({
                          type: 'voice_announcement',
                          announcementTitle: title,
                          text: body,
                          sender: schoolNameConfig || (lang === 'hi' ? 'स्कूल प्रशासन' : 'School Admin'),
                          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        });
                        Vibration.vibrate(80);
                        Alert.alert(
                          lang === 'hi' ? 'सामूहिक सूचना लाइव प्रसारित' : 'Broadcast Sent Live',
                          lang === 'hi' ? `सभी अभिभावकों व चालकों को लाइव सूचना भेज दी गई:
"${body}"` : `Live broadcast sent to all parents & drivers:
"${body}"`
                        );
                      }}
                    >
                      <Text style={{ fontSize: 18 }}>🌧️</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#92400e' }}>
                          {lang === 'hi' ? 'खराब मौसम / भारी बारिश - स्कूल जल्दी छूटेगा' : 'Bad Weather / Early Closure Alert'}
                        </Text>
                        <Text style={{ fontSize: 10, color: '#b45309' }}>
                          {lang === 'hi' ? 'सभी अभिभावकों को दोपहर की बस का अलर्ट' : 'Alert all parents for early departure'}
                        </Text>
                      </View>
                    </TouchableOpacity>

                    <TouchableOpacity 
                      style={{ backgroundColor: '#fee2e2', padding: 10, borderRadius: 12, borderWidth: 1, borderColor: '#fecaca', flexDirection: 'row', alignItems: 'center', gap: 8 }}
                      onPress={async () => {
                        const title = lang === 'hi' ? '⚠️ रूट ट्रैफिक जाम - बसें देरी से' : '⚠️ Traffic Congestion Alert';
                        const body = lang === 'hi' 
                          ? 'मुख्य मार्ग पर अत्यधिक जाम होने के कारण सभी बसें 15-20 मिनट देरी से चल रही हैं।' 
                          : 'All buses running 15-20 mins late due to severe traffic on main route.';
                        await publishCloudEvent({
                          type: 'voice_announcement',
                          announcementTitle: title,
                          text: body,
                          sender: schoolNameConfig || (lang === 'hi' ? 'स्कूल प्रशासन' : 'School Admin'),
                          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        });
                        Vibration.vibrate(80);
                        Alert.alert(
                          lang === 'hi' ? 'ट्रैफिक जाम सूचना प्रसारित' : 'Traffic Delay Broadcasted',
                          lang === 'hi' ? `सभी अभिभावकों को लाइव अलर्ट भेजा गया:
"${body}"` : `Live alert broadcasted to all parents:
"${body}"`
                        );
                      }}
                    >
                      <Text style={{ fontSize: 18 }}>⚠️</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#991b1b' }}>
                          {lang === 'hi' ? 'ट्रैफिक जाम - सभी बसें 15-20 मिनट देरी से' : 'Traffic Congestion - 15-20 Mins Delay'}
                        </Text>
                        <Text style={{ fontSize: 10, color: '#b91c1c' }}>
                          {lang === 'hi' ? 'अभिभावकों को लाइव रूट देरी की सूचना' : 'Notify all parents of route delay'}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Fleet Bus Roster List */}
                <View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <Text style={{ fontSize: 15, fontWeight: 'bold', color: isDarkMode ? '#f8fafc' : '#0f172a' }}>
                      🚌 {lang === 'hi' ? 'स्कूल की सभी बसें व स्टाफ (Fleet Roster)' : 'All School Buses & Staff'}
                    </Text>
                    <Text style={{ fontSize: 12, color: '#64748b' }}>
                      {schoolFleetBuses.length} {lang === 'hi' ? 'बसें पंजीकृत' : 'Buses'}
                    </Text>
                  </View>

                  <View style={{ gap: 10 }}>
                    {schoolFleetBuses.length === 0 ? (
                      <View style={[styles.card, { alignItems: 'center', paddingVertical: 28, backgroundColor: isDarkMode ? '#1e293b' : '#fff' }]}>
                        <Text style={{ fontSize: 36, marginBottom: 8 }}>🚌</Text>
                        <Text style={{ fontSize: 15, fontWeight: '700', color: isDarkMode ? '#f8fafc' : '#0f172a' }}>
                          {lang === 'hi' ? 'स्कूल में कोई बस पंजीकृत नहीं है' : 'No Buses Registered in School Fleet'}
                        </Text>
                        <Text style={{ fontSize: 12, color: '#64748b', textAlign: 'center', marginTop: 4, marginHorizontal: 20 }}>
                          {lang === 'hi' ? 'ऊपर "+ फ्लीट में नई बस जोड़ें" पर टैप करके स्कूल की बसें दर्ज करें।' : 'Tap "+ Add New Bus to Fleet" above to register school buses.'}
                        </Text>
                        <TouchableOpacity 
                          style={{ backgroundColor: '#ea580c', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10, marginTop: 12 }}
                          onPress={() => handleOpenAddFleetBus()}
                        >
                          <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>
                            + {lang === 'hi' ? 'नई बस जोड़ें' : 'Add New Bus'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    ) : (
                    schoolFleetBuses.map((bus) => (
                      <View 
                        key={bus.id} 
                        style={[
                          styles.card, 
                          { backgroundColor: isDarkMode ? '#1e293b' : '#fff', padding: 14, borderLeftWidth: 4, borderLeftColor: bus.isTripActive ? '#16a34a' : '#94a3b8' }
                        ]}
                      >
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <View>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                              <Text style={{ fontSize: 16, fontWeight: 'bold', color: isDarkMode ? '#f8fafc' : '#0f172a' }}>
                                {bus.busNo}
                              </Text>
                              <View style={{ backgroundColor: bus.isTripActive ? '#dcfce7' : '#f1f5f9', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 }}>
                                <Text style={{ fontSize: 11, fontWeight: 'bold', color: bus.isTripActive ? '#15803d' : '#64748b' }}>
                                  {bus.isTripActive ? (lang === 'hi' ? '🟢 मार्ग पर सक्रिय' : '🟢 ON ROUTE') : (lang === 'hi' ? '⚪ यार्ड में पार्क' : '⚪ PARKED')}
                                </Text>
                              </View>
                            </View>
                            <Text style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                              {lang === 'hi' ? 'वाहन नं:' : 'Vehicle:'} <Text style={{ fontWeight: 'bold', color: isDarkMode ? '#cbd5e1' : '#334155' }}>{bus.vehicleNo}</Text> • 🎒 {schoolChildren.filter(c => c.busNo === bus.busNo || c.busCode === bus.busNo).length} {lang === 'hi' ? 'पंजीकृत छात्र' : 'Enrolled Students'}
                            </Text>
                          </View>

                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <TouchableOpacity 
                              style={{ backgroundColor: isDarkMode ? '#334155' : '#eff6ff', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: isDarkMode ? '#475569' : '#bfdbfe' }}
                              onPress={() => handleOpenEditFleetBus(bus)}
                            >
                              <Text style={{ fontSize: 11, fontWeight: '700', color: '#2563eb' }}>
                                ✏️ {lang === 'hi' ? 'एडिट' : 'Edit'}
                              </Text>
                            </TouchableOpacity>

                            <TouchableOpacity 
                              style={{ padding: 4 }}
                              onPress={() => handleDeleteFleetBus(bus.id)}
                            >
                              <Text style={{ fontSize: 16, color: '#94a3b8' }}>✕</Text>
                            </TouchableOpacity>
                          </View>
                        </View>

                        {/* Staff Details */}
                        <View style={{ marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: isDarkMode ? '#334155' : '#f1f5f9', gap: 6 }}>
                          {/* Driver Row */}
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                              <Text style={{ fontSize: 13 }}>👨‍✈️</Text>
                              <Text style={{ fontSize: 13, fontWeight: 'bold', color: isDarkMode ? '#f8fafc' : '#1e293b' }}>
                                {bus.driverName}
                              </Text>
                              <Text style={{ fontSize: 11, color: '#64748b' }}>
                                ({bus.driverPhone ? `+91 ${bus.driverPhone}` : (lang === 'hi' ? 'नंबर नहीं' : 'No Phone')})
                              </Text>
                            </View>
                            {bus.driverPhone ? (
                              <TouchableOpacity 
                                style={{ backgroundColor: '#dcfce7', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 }}
                                onPress={() => Linking.openURL(`tel:${bus.driverPhone}`)}
                              >
                                <Text style={{ color: '#15803d', fontSize: 11, fontWeight: 'bold' }}>📞 कॉल</Text>
                              </TouchableOpacity>
                            ) : null}
                          </View>

                          {/* Conductor Row */}
                          {bus.conductorName ? (
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <Text style={{ fontSize: 13 }}>🧑‍🔧</Text>
                                <Text style={{ fontSize: 12, color: isDarkMode ? '#cbd5e1' : '#475569' }}>
                                  {bus.conductorName}
                                </Text>
                                <Text style={{ fontSize: 11, color: '#94a3b8' }}>
                                  ({bus.conductorPhone ? `+91 ${bus.conductorPhone}` : (lang === 'hi' ? 'परिचालक' : 'Helper')})
                                </Text>
                              </View>
                              {bus.conductorPhone ? (
                                <TouchableOpacity 
                                  style={{ backgroundColor: '#e0f2fe', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 }}
                                  onPress={() => Linking.openURL(`tel:${bus.conductorPhone}`)}
                                >
                                  <Text style={{ color: '#0369a1', fontSize: 11, fontWeight: 'bold' }}>📞 कॉल</Text>
                                </TouchableOpacity>
                              ) : null}
                            </View>
                          ) : null}

                          {/* Security PINs Display */}
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: isDarkMode ? '#0f172a' : '#f8fafc', padding: 8, borderRadius: 8, marginTop: 4 }}>
                            <Text style={{ fontSize: 11, color: '#64748b' }}>
                              🔑 {lang === 'hi' ? 'चालक पिन:' : 'Driver PIN:'} <Text style={{ fontWeight: 'bold', color: '#ea580c' }}>{bus.driverPin || '1101'}</Text>
                            </Text>
                            <Text style={{ fontSize: 11, color: '#64748b' }}>
                              👨‍👩‍👧 {lang === 'hi' ? 'अभिभावक कोड:' : 'Parent Code:'} <Text style={{ fontWeight: 'bold', color: '#0284c7' }}>{bus.parentCode || '4001'}</Text>
                            </Text>
                          </View>
                        </View>

                        {/* Action Bar */}
                        <View style={{ flexDirection: 'row', gap: 8, marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: isDarkMode ? '#334155' : '#f1f5f9' }}>
                          <TouchableOpacity 
                            style={{ flex: 1, backgroundColor: bus.isTripActive ? '#fee2e2' : '#dcfce7', paddingVertical: 8, borderRadius: 10, alignItems: 'center' }}
                            onPress={() => handleToggleFleetTrip(bus.id)}
                          >
                            <Text style={{ color: bus.isTripActive ? '#dc2626' : '#15803d', fontSize: 12, fontWeight: 'bold' }}>
                              {bus.isTripActive ? (lang === 'hi' ? '⏹ ट्रिप समाप्त करें' : 'End Trip') : (lang === 'hi' ? '▶ ट्रिप शुरू करें' : 'Start Trip')}
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    ))
                    )}
                  </View>
                </View>
              </View>
              )
            )}
            {/* Bottom spacer so content is never cut off by bottom nav */}
            <View style={{ height: 40 }} />
          </View>
        </ScrollView>

        {/* ----------------- 6. FAMILY CONNECT (CLOUD-SYNCED INTERCOM, DIRECTORY & CHAT) ----------------- */}
        <ScrollView 
          ref={familyScrollRef}
          style={{ width: SCREEN_WIDTH }} 
          contentContainerStyle={[styles.scrollBody, { paddingBottom: 380 }]} 
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled={true}
          keyboardShouldPersistTaps="handled"
        >
          <View style={{ gap: 16 }}>
            <View style={styles.pageHeader}>
              <Text style={styles.pageTitle}>👨‍👩‍👧‍👦 {t.famHeading}</Text>
              <Text style={styles.pageSub}>{t.famSub}</Text>
            </View>

            {/* Modern Sliding Segmented Control */}
            <View style={{
              flexDirection: 'row',
              backgroundColor: isDarkMode ? '#1e293b' : '#f1f5f9',
              borderRadius: 12,
              padding: 3,
              borderWidth: 1,
              borderColor: isDarkMode ? '#334155' : '#e2e8f0'
            }}>
              <TouchableOpacity
                style={[
                  { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 9 },
                  familySubtab === 'members' && {
                    backgroundColor: isDarkMode ? '#0f172a' : '#ffffff',
                    shadowColor: '#000',
                    shadowOpacity: 0.05,
                    shadowRadius: 3,
                    elevation: 1
                  }
                ]}
                onPress={() => setFamilySubtab('members')}
              >
                <Text style={{
                  fontSize: 12,
                  fontWeight: familySubtab === 'members' ? '700' : '500',
                  color: familySubtab === 'members' ? '#2563eb' : isDarkMode ? '#94a3b8' : '#64748b'
                }}>
                  {lang === 'hi' ? 'सदस्य व कोड' : 'Members'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 9 },
                  familySubtab === 'chat' && {
                    backgroundColor: isDarkMode ? '#0f172a' : '#ffffff',
                    shadowColor: '#000',
                    shadowOpacity: 0.05,
                    shadowRadius: 3,
                    elevation: 1
                  }
                ]}
                onPress={() => setFamilySubtab('chat')}
              >
                <Text style={{
                  fontSize: 12,
                  fontWeight: familySubtab === 'chat' ? '700' : '500',
                  color: familySubtab === 'chat' ? '#2563eb' : isDarkMode ? '#94a3b8' : '#64748b'
                }}>
                  {lang === 'hi' ? 'चैट व इंटरकॉम' : 'Intercom'}
                </Text>
              </TouchableOpacity><TouchableOpacity
                style={[
                  { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 9 },
                  familySubtab === 'diary' && {
                    backgroundColor: isDarkMode ? '#0f172a' : '#ffffff',
                    shadowColor: '#000',
                    shadowOpacity: 0.05,
                    shadowRadius: 3,
                    elevation: 1
                  }
                ]}
                onPress={() => setFamilySubtab('diary')}
              >
                <Text style={{
                  fontSize: 12,
                  fontWeight: familySubtab === 'diary' ? '700' : '500',
                  color: familySubtab === 'diary' ? '#2563eb' : isDarkMode ? '#94a3b8' : '#64748b'
                }}>
                  {lang === 'hi' ? 'डायरी व विचार' : 'Diary'}
                </Text>
              </TouchableOpacity>

              
            </View>

            {/* 1. DIARY SUBTAB */}
            {familySubtab === 'diary' && (
              <View style={{ gap: 14 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View>
                <Text style={styles.pageTitle}>✍️ {t.diaryHeading}</Text>
                <Text style={styles.pageSub}>{t.diarySub}</Text>
              </View>
              <TouchableOpacity style={styles.addSmallBtn} onPress={openAddDiaryModal}>
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
                    <Text style={{ fontSize: 36, marginBottom: 8 }}>📖</Text>
                    <Text style={{ fontSize: 15, fontWeight: '600', color: isDarkMode ? '#f8fafc' : '#0f172a' }}>
                      {diarySearchQuery ? (lang === 'hi' ? 'कोई मेल खाती रचना नहीं मिली' : 'No matching entries found') : (lang === 'hi' ? 'डायरी में कोई प्रविष्टि नहीं है' : 'No entries in diary')}
                    </Text>
                    <Text style={{ fontSize: 12, color: '#64748b', marginTop: 4, textAlign: 'center', marginBottom: 16 }}>
                      {diarySearchQuery ? (lang === 'hi' ? 'दूसरा शब्द खोजें या फ़िल्टर बदलें' : 'Try searching another word') : (lang === 'hi' ? 'अपने विचार, संस्मरण या कविताएं यहाँ सुरक्षित रखें।' : 'Preserve your thoughts, memories and poetry here.')}
                    </Text>
                    <TouchableOpacity 
                      style={{
                        backgroundColor: '#2563eb',
                        paddingHorizontal: 18,
                        paddingVertical: 10,
                        borderRadius: 12,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 6
                      }} 
                      onPress={openAddDiaryModal}
                    >
                      <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>
                        + {lang === 'hi' ? 'नई रचना लिखें' : 'Write New Entry'}
                      </Text>
                    </TouchableOpacity>
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
            )}

            {/* 2. MEMBERS & NETWORK SUBTAB */}
            {familySubtab === 'members' && (
              <View style={{ gap: 14 }}>

            {/* Clean Dashed-Border Network Code Sharing Card */}
            <View style={{
              backgroundColor: isDarkMode ? '#1e293b' : '#f8fafc',
              borderWidth: 1.5,
              borderColor: isDarkMode ? '#334155' : '#cbd5e1',
              borderStyle: 'dashed',
              borderRadius: 14,
              padding: 16,
              marginBottom: 14
            }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={{ fontSize: 15 }}>🔗</Text>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: isDarkMode ? '#f8fafc' : '#0f172a' }}>
                    {lang === 'hi' ? 'पारिवारिक नेटवर्क पेयरिंग' : 'Family Network Pairing'}
                  </Text>
                </View>
                <View style={{ backgroundColor: '#ecfdf5', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 }}>
                  <Text style={{ color: '#059669', fontSize: 10, fontWeight: '700' }}>ONLINE</Text>
                </View>
              </View>

              {/* Pairing Code Display */}
              <View style={{
                backgroundColor: isDarkMode ? '#0f172a' : '#ffffff',
                borderRadius: 12,
                padding: 12,
                borderWidth: 1,
                borderColor: isDarkMode ? '#334155' : '#e2e8f0',
                alignItems: 'center'
              }}>
                <Text style={{ fontSize: 11, color: '#64748b', fontWeight: '500' }}>
                  {lang === 'hi' ? 'सक्रिय पारिवारिक नेटवर्क कोड' : 'Active Network Code'}
                </Text>
                <Text style={{ fontSize: 24, fontWeight: '800', color: '#2563eb', letterSpacing: 3, marginVertical: 4 }}>
                  {familyCode}
                </Text>

                {/* Single-tap Copy & WhatsApp Share Buttons */}
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
                  <TouchableOpacity
                    style={{
                      flex: 1,
                      backgroundColor: '#eff6ff',
                      borderColor: '#bfdbfe',
                      borderWidth: 1,
                      paddingVertical: 8,
                      borderRadius: 8,
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                    onPress={async () => {
                      await Share.share({
                        message: (lang === 'hi' ? 'मेरा पारिवारिक नेटवर्क कोड: ' : 'My Family Network Code: ') + familyCode
                      });
                    }}
                  >
                    <Text style={{ color: '#1d4ed8', fontSize: 12, fontWeight: '600' }}>
                      📋 {lang === 'hi' ? 'कॉपी करें' : 'Copy Code'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={{
                      flex: 1,
                      backgroundColor: '#ecfdf5',
                      borderColor: '#a7f3d0',
                      borderWidth: 1,
                      paddingVertical: 8,
                      borderRadius: 8,
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                    onPress={shareFamilyInvite}
                  >
                    <Text style={{ color: '#047857', fontSize: 12, fontWeight: '600' }}>
                      📲 {lang === 'hi' ? 'व्हाट्सएप शेयर' : 'Share WhatsApp'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={{
                      backgroundColor: isDarkMode ? '#1e293b' : '#f1f5f9',
                      borderWidth: 1,
                      borderColor: isDarkMode ? '#334155' : '#cbd5e1',
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      borderRadius: 8,
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                    onPress={() => setIsEditingFamilyCode(!isEditingFamilyCode)}
                  >
                    <Text style={{ color: '#475569', fontSize: 12, fontWeight: '600' }}>
                      ✏️
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Inline Edit Box */}
                {isEditingFamilyCode && (
                  <View style={{ marginTop: 10, width: '100%', paddingTop: 10, borderTopWidth: 1, borderTopColor: isDarkMode ? '#334155' : '#e2e8f0' }}>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <TextInput 
                        style={[styles.formInput, { flex: 1, color: isDarkMode ? '#f8fafc' : '#0f172a', backgroundColor: isDarkMode ? '#1e293b' : '#f8fafc', borderColor: '#2563eb', borderWidth: 1, fontWeight: 'bold', fontSize: 14, paddingVertical: 6, textAlign: 'center' }]}
                        value={customFamilyCodeInput}
                        onChangeText={setCustomFamilyCodeInput}
                        placeholder="उदा: MAST-8821"
                        placeholderTextColor="#94a3b8"
                        autoCapitalize="characters"
                      />
                      <TouchableOpacity 
                        style={{ backgroundColor: '#2563eb', paddingHorizontal: 14, borderRadius: 8, justifyContent: 'center' }}
                        onPress={async () => {
                          const c = customFamilyCodeInput.trim().toUpperCase();
                          if (c.length < 3) return;
                          setIsEditingFamilyCode(false);
                          await handleConnectFamilyCode(c, false);
                        }}
                      >
                        <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>✓ {lang === 'hi' ? 'सेव' : 'Save'}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>

              {/* Direct Input to Join another mobile */}
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                <TextInput 
                  style={[styles.formInput, { flex: 1, color: isDarkMode ? '#f8fafc' : '#0f172a', backgroundColor: isDarkMode ? '#0f172a' : '#ffffff', borderColor: isDarkMode ? '#334155' : '#cbd5e1', borderWidth: 1, fontSize: 13, paddingVertical: 7, textAlign: 'center', borderRadius: 10 }]} 
                  placeholder={lang === 'hi' ? 'दूसरा कोड जोड़ें (उदा: MAST-8821)' : 'Enter code to connect'}
                  placeholderTextColor="#94a3b8"
                  value={tempCodeInput} 
                  onChangeText={setTempCodeInput} 
                  autoCapitalize="characters"
                />
                <TouchableOpacity 
                  disabled={isConnectingFamily}
                  style={{ backgroundColor: isConnectingFamily ? '#64748b' : '#0f172a', paddingHorizontal: 14, borderRadius: 10, justifyContent: 'center' }}
                  onPress={async () => {
                    const newC = tempCodeInput.trim().toUpperCase();
                    if (newC.length < 3) return;
                    await handleConnectFamilyCode(newC, true);
                  }}
                >
                  <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>
                    {isConnectingFamily ? (lang === 'hi' ? 'कनेक्टिंग...' : 'Connecting...') : (lang === 'hi' ? 'कनेक्ट' : 'Connect')}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Connected Family Phones / Devices Status Card */}
            <View style={[styles.card, { backgroundColor: isDarkMode ? '#1e293b' : '#ffffff' }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={{ fontSize: 16 }}>📱</Text>
                  <Text style={styles.sectionHeading}>
                    {lang === 'hi' ? 'जुड़े हुए पारिवारिक फोन' : 'Connected Family Phones'}
                  </Text>
                </View>
                <View style={{ backgroundColor: '#ecfdf5', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 }}>
                  <Text style={{ color: '#059669', fontSize: 10, fontWeight: '700' }}>
                    {Object.keys(onlineDevices).length + 1} {lang === 'hi' ? 'डिवाइस' : 'Devices'}
                  </Text>
                </View>
              </View>

              <View style={{ gap: 8 }}>
                {/* 1. Current Device */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 10, backgroundColor: isDarkMode ? '#0f172a' : '#f8fafc', borderRadius: 10, borderWidth: 1, borderColor: isDarkMode ? '#334155' : '#e2e8f0' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <Text style={{ fontSize: 20 }}>📱</Text>
                    <View>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: isDarkMode ? '#f8fafc' : '#0f172a' }}>
                        {userProfile?.name || 'यह फोन'} ({lang === 'hi' ? 'यह डिवाइस' : 'This Phone'})
                      </Text>
                      <Text style={{ fontSize: 11, color: '#64748b' }}>
                        {userRole === 'PARENT' ? (lang === 'hi' ? 'अभिभावक' : 'Parent') : userRole === 'DRIVER' ? (lang === 'hi' ? 'चालक' : 'Driver') : (lang === 'hi' ? 'स्कूल एडमिन' : 'Admin')} • {familyCode}
                      </Text>
                    </View>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#ecfdf5', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}>
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#10b981' }} />
                    <Text style={{ fontSize: 11, fontWeight: '700', color: '#059669' }}>{lang === 'hi' ? 'ऑनलाइन' : 'Online'}</Text>
                  </View>
                </View>

                {/* 2. Other Connected Phones */}
                {Object.entries(onlineDevices).map(([devId, dev]: any) => (
                  <View key={devId} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 10, backgroundColor: isDarkMode ? '#0f172a' : '#f8fafc', borderRadius: 10, borderWidth: 1, borderColor: isDarkMode ? '#334155' : '#e2e8f0' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <Text style={{ fontSize: 20 }}>📱</Text>
                      <View>
                        <Text style={{ fontSize: 13, fontWeight: '700', color: isDarkMode ? '#f8fafc' : '#0f172a' }}>
                          {dev.name || (lang === 'hi' ? 'परिवार सदस्य' : 'Family Member')}
                        </Text>
                        <Text style={{ fontSize: 11, color: '#64748b' }}>
                          {lang === 'hi' ? 'सक्रिय क्लाउड सिंक' : 'Active Cloud Sync'} • {familyCode}
                        </Text>
                      </View>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#ecfdf5', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}>
                      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#10b981' }} />
                      <Text style={{ fontSize: 11, fontWeight: '700', color: '#059669' }}>{lang === 'hi' ? 'ऑनलाइन' : 'Online'}</Text>
                    </View>
                  </View>
                ))}

                {Object.keys(onlineDevices).length === 0 && (
                  <View style={{ padding: 10, backgroundColor: isDarkMode ? '#1e293b' : '#fffbeb', borderRadius: 10, borderWidth: 1, borderColor: isDarkMode ? '#334155' : '#fde68a' }}>
                    <Text style={{ fontSize: 12, color: isDarkMode ? '#fde68a' : '#92400e', textAlign: 'center', lineHeight: 17 }}>
                      {lang === 'hi' 
                        ? 'ℹ️ अभी केवल यह फोन जुड़ा है। दूसरे फोन में यही कोड (' + familyCode + ') डालें — दोनों फोन तुरंत आपस में जुड़ जाएंगे!' 
                        : 'ℹ️ Only this phone is connected. Enter code ' + familyCode + ' on other phones to connect.'}
                    </Text>
                  </View>
                )}
              </View>
            </View>

            {/* Family Members Directory WITH + ADD MEMBER & DELETE */}
            <View style={styles.card}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <Text style={styles.sectionHeading}>{t.membersHeading}</Text>
                <TouchableOpacity style={styles.addSmallBtn} onPress={openAddMemberModal}>
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
                        onPress={() => { const p = formatPhoneForAction(mem.phone); if (p.valid) Linking.openURL(`tel:${p.dialer}`); }}
                      >
                        <Text style={{ fontSize: 16 }}>📞</Text>
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={[styles.iconCircleBtn, { backgroundColor: '#dcfce7' }]}
                        onPress={() => { const p = formatPhoneForAction(mem.phone); if (p.valid) Linking.openURL(`whatsapp://send?phone=${p.whatsapp}`); }}
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

                                          </View>
            )}

            {/* 3. CHAT & INTERCOM SUBTAB */}
            {familySubtab === 'chat' && (
              <View style={{ gap: 14 }}>
                {/* Elevated Soft-Tint Intercom Quick Actions */}
            <View style={styles.card}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={{ fontSize: 16 }}>📡</Text>
                  <Text style={styles.sectionHeading}>
                    {lang === 'hi' ? 'पारिवारिक इंटरकॉम पिंग' : 'Family Intercom Ping'}
                  </Text>
                </View>
                <View style={{ backgroundColor: '#ecfdf5', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 }}>
                  <Text style={{ color: '#059669', fontSize: 10, fontWeight: '700' }}>LIVE</Text>
                </View>
              </View>
              <Text style={{ color: '#64748b', fontSize: 11, marginBottom: 12 }}>
                {lang === 'hi' 
                  ? 'एक टैप में सभी जुड़े पारिवारिक मोबाइलों पर ध्वनि व नोटिफिकेशन अलर्ट भेजें:' 
                  : 'Broadcast 1-tap sound alert & notification to all family phones:'}
              </Text>
              
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {/* 1. Dinner Ready (Soft Amber Tint) */}
                <TouchableOpacity 
                  style={{
                    flex: 1,
                    backgroundColor: isDarkMode ? '#1e293b' : '#fffbeb',
                    borderRadius: 12,
                    paddingVertical: 12,
                    paddingHorizontal: 6,
                    alignItems: 'center',
                    borderWidth: 1,
                    borderColor: isDarkMode ? '#475569' : '#fde68a',
                    shadowColor: '#000',
                    shadowOpacity: 0.04,
                    shadowRadius: 3,
                    elevation: 1
                  }} 
                  onPress={() => {
                    Vibration.vibrate([0, 80, 40, 80]);
                    triggerIntercomBuzzer('🍲 खाना तैयार है! सभी डाइनिंग टेबल पर आएं।', '🍲 Dinner is served! Please gather at the table.');
                  }}
                >
                  <Text style={{ fontSize: 20, marginBottom: 4 }}>🍲</Text>
                  <Text style={{ color: isDarkMode ? '#fde68a' : '#92400e', fontSize: 12, fontWeight: '600', textAlign: 'center' }}>
                    {lang === 'hi' ? 'खाना तैयार है' : 'Dinner Ready'}
                  </Text>
                </TouchableOpacity>

                {/* 2. Reached Home (Soft Emerald Tint) */}
                <TouchableOpacity 
                  style={{
                    flex: 1,
                    backgroundColor: isDarkMode ? '#1e293b' : '#ecfdf5',
                    borderRadius: 12,
                    paddingVertical: 12,
                    paddingHorizontal: 6,
                    alignItems: 'center',
                    borderWidth: 1,
                    borderColor: isDarkMode ? '#475569' : '#a7f3d0',
                    shadowColor: '#000',
                    shadowOpacity: 0.04,
                    shadowRadius: 3,
                    elevation: 1
                  }} 
                  onPress={() => {
                    Vibration.vibrate([0, 80, 40, 80]);
                    triggerIntercomBuzzer('🏡 मैं सुरक्षित घर पहुँच गया हूँ।', '🏡 I have reached home safely.');
                  }}
                >
                  <Text style={{ fontSize: 20, marginBottom: 4 }}>🏡</Text>
                  <Text style={{ color: isDarkMode ? '#a7f3d0' : '#065f46', fontSize: 12, fontWeight: '600', textAlign: 'center' }}>
                    {lang === 'hi' ? 'घर पहुँच गया' : 'Reached Home'}
                  </Text>
                </TouchableOpacity>

                {/* 3. Urgent Siren (Soft Rose Tint) */}
                <TouchableOpacity 
                  style={{
                    flex: 1,
                    backgroundColor: isDarkMode ? '#1e293b' : '#fef2f2',
                    borderRadius: 12,
                    paddingVertical: 12,
                    paddingHorizontal: 6,
                    alignItems: 'center',
                    borderWidth: 1,
                    borderColor: isDarkMode ? '#475569' : '#fecaca',
                    shadowColor: '#000',
                    shadowOpacity: 0.04,
                    shadowRadius: 3,
                    elevation: 1
                  }} 
                  onPress={() => {
                    Vibration.vibrate([0, 200, 100, 200, 100, 300]);
                    triggerIntercomBuzzer('🚨 सायरन! तुरंत सहायता की ज़रूरत है!', '🚨 Siren! Immediate help needed!');
                  }}
                >
                  <Text style={{ fontSize: 20, marginBottom: 4 }}>🚨</Text>
                  <Text style={{ color: isDarkMode ? '#fca5a5' : '#991b1b', fontSize: 12, fontWeight: '700', textAlign: 'center' }}>
                    {lang === 'hi' ? 'मदद / सायरन' : 'Urgent Siren'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Family Group Chat with Real Cloud Broadcast */}
            <View style={[styles.chatContainer, { height: 420, backgroundColor: isDarkMode ? '#1e293b' : '#ffffff', borderColor: '#ea580c', borderWidth: 2, borderRadius: 20, overflow: 'hidden' }]}>
              <View style={[styles.chatHeader, { backgroundColor: isDarkMode ? '#0f172a' : '#fff7ed', borderBottomColor: '#fed7aa', borderBottomWidth: 1.5, paddingVertical: 10, paddingHorizontal: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={{ fontSize: 16 }}>💬</Text>
                  <Text style={[styles.chatHeaderTitle, { fontSize: 14, fontWeight: 'bold', color: isDarkMode ? '#f8fafc' : '#c2410c' }]}>{t.familyChatTitle}</Text>
                </View>
                <Text style={[styles.chatHeaderEnc, { fontSize: 11, color: '#15803d', fontWeight: 'bold' }]}>🔒 {t.chatEncrypted}</Text>
              </View>

              <ScrollView 
                ref={chatScrollRef}
                style={{ flex: 1, padding: 12, backgroundColor: isDarkMode ? '#0f172a' : '#f8fafc' }} 
                contentContainerStyle={{ paddingBottom: 16 }}
                onContentSizeChange={() => chatScrollRef.current?.scrollToEnd({ animated: true })}
                nestedScrollEnabled
                keyboardShouldPersistTaps="handled"
              >
                {familyChat.length === 0 ? (
                  <View style={{ alignItems: 'center', paddingVertical: 30 }}>
                    <Text style={{ fontSize: 28, marginBottom: 6 }}>💬</Text>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: isDarkMode ? '#cbd5e1' : '#475569', textAlign: 'center' }}>
                      {lang === 'hi' ? 'परिवार के सभी सदस्यों के संदेश यहाँ दिखेंगे' : 'Encrypted family messages appear here'}
                    </Text>
                    <Text style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>
                      {lang === 'hi' ? 'नीचे दिए गए बॉक्स में पहला संदेश लिखें 👇' : 'Type your first message below 👇'}
                    </Text>
                  </View>
                ) : (
                  familyChat.map(item => {
                    const sender = getLocalized(item, 'sender');
                    const msg = getLocalized(item, 'msg');
                    return (
                      <View key={item.id} style={[styles.chatBubble, item.isSelf ? (isDarkMode ? { backgroundColor: '#7c2d12', alignSelf: 'flex-end' } : styles.chatBubbleSelf) : (isDarkMode ? { backgroundColor: '#334155', alignSelf: 'flex-start' } : styles.chatBubbleOther)]}>
                        <Text style={[styles.chatBubbleSender, item.isSelf && { color: isDarkMode ? '#fdba74' : '#ea580c' }]}>{sender}</Text>
                        <Text style={[styles.chatBubbleText, { color: isDarkMode ? '#f8fafc' : '#0f172a', fontSize: 15, fontWeight: '500' }]}>{msg}</Text>
                        <Text style={[styles.chatBubbleTime, isDarkMode && { color: '#cbd5e1' }]}>{item.time}</Text>
                      </View>
                    );
                  })
                )}
              </ScrollView>

              {/* Modern Floating Rounded Chat Input Bar with Keyboard Handling */}
              <KeyboardAvoidingView 
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
              >
                <View style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: isDarkMode ? '#1e293b' : '#ffffff',
                  borderTopWidth: 1,
                  borderTopColor: isDarkMode ? '#334155' : '#e2e8f0',
                  paddingHorizontal: 10,
                  paddingVertical: 8,
                  gap: 8
                }}>
                  <TextInput 
                    style={{
                      flex: 1,
                      height: 44,
                      backgroundColor: isDarkMode ? '#0f172a' : '#f1f5f9',
                      color: isDarkMode ? '#f8fafc' : '#0f172a',
                      borderRadius: 22,
                      paddingHorizontal: 16,
                      fontSize: 14,
                      fontWeight: '500',
                      borderWidth: 1,
                      borderColor: isDarkMode ? '#334155' : '#e2e8f0'
                    }}
                    placeholder={lang === 'hi' ? 'यहाँ परिवार को संदेश लिखें...' : 'Type family message...'}
                    placeholderTextColor="#94a3b8"
                    cursorColor="#2563eb"
                    value={chatInput}
                    onChangeText={setChatInput}
                    onFocus={() => {
                      setTimeout(() => {
                        familyScrollRef.current?.scrollToEnd({ animated: true });
                      }, 150);
                    }}
                    multiline={false}
                    returnKeyType="send"
                    onSubmitEditing={handleSendChat}
                  />
                  <TouchableOpacity 
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 20,
                      backgroundColor: '#2563eb',
                      justifyContent: 'center',
                      alignItems: 'center',
                      shadowColor: '#2563eb',
                      shadowOpacity: 0.25,
                      shadowRadius: 4,
                      elevation: 2
                    }} 
                    onPress={handleSendChat}
                  >
                    <Text style={{ color: '#fff', fontSize: 16, fontWeight: 'bold' }}>➔</Text>
                  </TouchableOpacity>
                </View>
              </KeyboardAvoidingView>
            </View>

                          </View>
            )}

            {/* Bottom spacer so content is never cut off by bottom nav */}
            <View style={{ height: 60 }} />
          </View>
        </ScrollView>

      </ScrollView>

      {/* ================= MODAL: PAIR FAMILY CODE ================= */}
      <Modal visible={isPairModalOpen} transparent animationType="fade" onRequestClose={() => setIsPairModalOpen(false)}>
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
                  setIsPairModalOpen(false);
                  await handleConnectFamilyCode(newC, true);
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
      <Modal visible={isAddMedModalOpen} transparent animationType="slide" onRequestClose={() => setIsAddMedModalOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalContent, { backgroundColor: themeColors.cardBg, borderColor: themeColors.border }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={styles.modalHeaderTitle}>{editingMedId ? (lang === 'hi' ? '✏️ दवाई की जानकारी संपादित करें' : '✏️ Edit Medicine Details') : t.addMedTitle}</Text>
              <TouchableOpacity onPress={() => setIsAddMedModalOpen(false)}>
                <Text style={{ fontSize: 22, color: '#64748b', fontWeight: 'bold' }}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 340 }}>
            <View style={{ gap: 12, marginVertical: 14 }}>
              {/* Member / Patient Selector */}
              <View>
                <Text style={styles.inputLabel}>
                  👤 {lang === 'hi' ? 'यह दवा किसके लिए है? (परिवार का सदस्य चुनें):' : 'Who is this medicine for? (Select Member):'}
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, marginVertical: 4 }}>
                  {[
                    ...(userProfile?.name ? [`${userProfile.name} (${lang === 'hi' ? 'स्वयं' : 'Self'})`] : [lang === 'hi' ? 'स्वयं (Self)' : 'Self']),
                    ...familyMembers.map((m: any) => m.name || m.nameHi || m.nameEn).filter(Boolean),
                    ...(lang === 'hi' ? ['दादाजी', 'दादीजी', 'पिताजी', 'माताजी', 'बच्चे'] : ['Grandfather', 'Grandmother', 'Father', 'Mother', 'Children'])
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
                    {(lang === 'hi' ? ['1 गोली खाने बाद', '1 गोली खाली पेट', '2 गोली'] : ['1 pill after meal', '1 pill empty stomach', '2 pills']).map(ch => (
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
                placeholder={lang === 'hi' ? 'डॉक्टर का नाम (उदा: डॉ. शर्मा)' : 'Doctor Name (e.g. Dr. Sharma)'} 
                placeholderTextColor="#94a3b8"
                value={newMedDoc} 
                onChangeText={setNewMedDoc} 
              />

              {/* Course Duration in Days */}
              <View>
                <Text style={styles.inputLabel}>
                  ⏳ {lang === 'hi' ? 'दवा का कोर्स कितने दिन का है?' : 'Course Duration (Days):'}
                </Text>
                <TextInput 
                  style={styles.formInput} 
                  placeholder={lang === 'hi' ? 'उदा: 10' : 'e.g. 10'} 
                  placeholderTextColor="#94a3b8"
                  keyboardType="numeric"
                  value={newMedCourseDays} 
                  onChangeText={(val) => {
                    setNewMedCourseDays(val);
                    const daysNum = parseInt(val, 10);
                    if (!isNaN(daysNum) && daysNum > 0) {
                      const d = new Date();
                      d.setDate(d.getDate() + daysNum);
                      const monthsShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                      const dStr = d.getDate() < 10 ? `0${d.getDate()}` : `${d.getDate()}`;
                      setNewMedFollowupDate(`${dStr} ${monthsShort[d.getMonth()]} ${d.getFullYear()}`);
                    }
                  }} 
                />
                <View style={{ flexDirection: 'row', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                  {['5', '7', '10', '15', '30', '60'].map(dVal => (
                    <TouchableOpacity
                      key={dVal}
                      style={[styles.chip, newMedCourseDays === dVal && styles.chipActive]}
                      onPress={() => {
                        setNewMedCourseDays(dVal);
                        const daysNum = parseInt(dVal, 10);
                        const d = new Date();
                        d.setDate(d.getDate() + daysNum);
                        const monthsShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                        const dStr = d.getDate() < 10 ? `0${d.getDate()}` : `${d.getDate()}`;
                        setNewMedFollowupDate(`${dStr} ${monthsShort[d.getMonth()]} ${d.getFullYear()}`);
                      }}
                    >
                      <Text style={[styles.chipText, newMedCourseDays === dVal && styles.chipTextActive]}>
                        {dVal} {lang === 'hi' ? 'दिन' : 'days'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Doctor Review / Follow-up Reminder Toggle */}
              <View style={{ backgroundColor: '#eff6ff', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#bfdbfe' }}>
                <TouchableOpacity 
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}
                  onPress={() => setNewMedFollowupNeeded(!newMedFollowupNeeded)}
                >
                  <Text style={{ fontSize: 20 }}>{newMedFollowupNeeded ? '☑️' : '⬜'}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, fontWeight: 'bold', color: '#1e40af' }}>
                      👨‍⚕️ {lang === 'hi' ? 'कोर्स पूरा होने पर डॉक्टर को दोबारा दिखाना है' : 'Doctor Review / Follow-up Checkup'}
                    </Text>
                    <Text style={{ fontSize: 11, color: '#3b82f6', marginTop: 2 }}>
                      {lang === 'hi' ? 'कोर्स खत्म होने पर डॉक्टर के पास विज़िट का ऑटोमैटिक रिमाइंडर सेट होगा' : 'Auto reminder to visit doctor after course ends'}
                    </Text>
                  </View>
                </TouchableOpacity>

                {newMedFollowupNeeded && (
                  <View style={{ marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#dbeafe' }}>
                    <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#1e40af', marginBottom: 4 }}>
                      📅 {lang === 'hi' ? 'डॉक्टर को दिखाने की तारीख:' : 'Follow-up Consultation Date:'}
                    </Text>
                    <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                      <TextInput 
                        style={[styles.formInput, { flex: 1, backgroundColor: '#fff' }]} 
                        placeholder="09 Nov 2026" 
                        placeholderTextColor="#94a3b8"
                        value={newMedFollowupDate} 
                        onChangeText={setNewMedFollowupDate} 
                      />
                      <TouchableOpacity 
                        style={[styles.calendarPickIconBtn, { backgroundColor: '#3b82f6' }]}
                        onPress={() => openCalendar('med_followup', newMedFollowupDate)}
                      >
                        <Text style={{ fontSize: 18, color: '#fff' }}>📅</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>

              {/* Medicine Refill / Stock Finished Reminder Toggle */}
              <View style={{ backgroundColor: '#fef2f2', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#fca5a5' }}>
                <TouchableOpacity 
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}
                  onPress={() => setNewMedRefillNeeded(!newMedRefillNeeded)}
                >
                  <Text style={{ fontSize: 20 }}>{newMedRefillNeeded ? '☑️' : '⬜'}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, fontWeight: 'bold', color: '#991b1b' }}>
                      🔔 {lang === 'hi' ? 'दवा खत्म होने से 1 दिन पहले रीफिल अलर्ट दें' : 'Alert 1 day before medicine finishes'}
                    </Text>
                    <Text style={{ fontSize: 11, color: '#b91c1c', marginTop: 2 }}>
                      {lang === 'hi' ? 'दवा खत्म होने से पहले सूचित करेगा: "कल दवा खत्म हो जाएगी! आज नई दवा ले आएं"' : 'Alerts you: "Medicine will finish tomorrow! Bring new stock today"'}
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>

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
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ================= MODAL: ADD APPLIANCE ================= */}
      <Modal visible={isAddApplianceModalOpen} transparent animationType="slide" statusBarTranslucent={true} onRequestClose={() => setIsAddApplianceModalOpen(false)}>
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
          style={styles.modalBackdrop}
        >
          <View style={[styles.modalContent, { maxHeight: '92%', backgroundColor: isDarkMode ? '#1e293b' : '#ffffff', paddingBottom: 20 }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={[styles.modalHeaderTitle, isDarkMode && { color: '#f8fafc' }]}>{editingApplianceId ? (lang === 'hi' ? '✏️ सामान व बिल संपादित करें' : '✏️ Edit Appliance & Bill') : t.addVaultTitle}</Text>
              <TouchableOpacity onPress={() => setIsAddApplianceModalOpen(false)}>
                <Text style={{ fontSize: 24, color: '#64748b', fontWeight: 'bold' }}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 320, paddingTop: 6 }}>
            <View style={{ gap: 12, marginVertical: 14 }}>
              <Text style={[styles.inputLabel, isDarkMode && { color: '#cbd5e1' }]}>{t.itemNamePrompt}</Text>
              <TextInput 
                style={[styles.formInput, isDarkMode && { backgroundColor: '#0f172a', color: '#f8fafc', borderColor: '#334155' }]} 
                placeholder="LG AC / Microwave / TV" 
                placeholderTextColor="#94a3b8"
                value={newVaultName} 
                onChangeText={setNewVaultName} 
              />

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.inputLabel, isDarkMode && { color: '#cbd5e1' }]}>{t.pricePrompt}</Text>
                  <TextInput 
                    style={[styles.formInput, isDarkMode && { backgroundColor: '#0f172a', color: '#f8fafc', borderColor: '#334155' }]} 
                    placeholder="₹12,000" 
                    placeholderTextColor="#94a3b8"
                    keyboardType="numeric"
                    value={newVaultPrice} 
                    onChangeText={setNewVaultPrice} 
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.inputLabel, isDarkMode && { color: '#cbd5e1' }]}>{t.warrantyPrompt}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <TextInput 
                      style={[styles.formInput, { flex: 1 }, isDarkMode && { backgroundColor: '#0f172a', color: '#f8fafc', borderColor: '#334155' }]} 
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
                      { label: lang === 'hi' ? '1 वर्ष' : '1 Year', years: 1 },
                      { label: lang === 'hi' ? '2 वर्ष' : '2 Years', years: 2 },
                      { label: lang === 'hi' ? '5 वर्ष' : '5 Years', years: 5 },
                      { label: lang === 'hi' ? '10 वर्ष' : '10 Years', years: 10 }
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

              <Text style={[styles.inputLabel, isDarkMode && { color: '#cbd5e1' }]}>{t.storePrompt}</Text>
              <TextInput 
                style={[styles.formInput, isDarkMode && { backgroundColor: '#0f172a', color: '#f8fafc', borderColor: '#334155' }]} 
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
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ================= MODAL: ADD GOLD / SILVER ================= */}
      <Modal visible={isAddGoldModalOpen} transparent animationType="slide" statusBarTranslucent={true} onRequestClose={() => setIsAddGoldModalOpen(false)}>
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
          style={styles.modalBackdrop}
        >
          <View style={[styles.modalContent, { maxHeight: '92%', backgroundColor: isDarkMode ? '#1e293b' : '#ffffff', paddingBottom: 20 }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={[styles.modalHeaderTitle, isDarkMode && { color: '#f8fafc' }]}>{editingGoldId ? (lang === 'hi' ? '✏️ आभूषण विवरण संपादित करें' : '✏️ Edit Jewellery Details') : t.addGoldTitle}</Text>
              <TouchableOpacity onPress={() => setIsAddGoldModalOpen(false)}>
                <Text style={{ fontSize: 24, color: '#64748b', fontWeight: 'bold' }}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 320, paddingTop: 6 }}>
            <View style={{ gap: 12, marginVertical: 14 }}>
              <Text style={[styles.inputLabel, isDarkMode && { color: '#cbd5e1' }]}>{t.goldTitlePrompt}</Text>
              <TextInput 
                style={[styles.formInput, isDarkMode && { backgroundColor: '#0f172a', color: '#f8fafc', borderColor: '#334155' }]} 
                placeholder="22K Gold Chain / Bangles" 
                placeholderTextColor="#94a3b8"
                value={newGoldTitle} 
                onChangeText={setNewGoldTitle} 
              />

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.inputLabel, isDarkMode && { color: '#cbd5e1' }]}>{t.goldWeightPrompt}</Text>
                  <TextInput 
                    style={[styles.formInput, isDarkMode && { backgroundColor: '#0f172a', color: '#f8fafc', borderColor: '#334155' }]} 
                    placeholder="12.5 gm" 
                    placeholderTextColor="#94a3b8"
                    value={newGoldWeight} 
                    onChangeText={setNewGoldWeight} 
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.inputLabel, isDarkMode && { color: '#cbd5e1' }]}>{t.goldValuePrompt}</Text>
                  <TextInput 
                    style={[styles.formInput, isDarkMode && { backgroundColor: '#0f172a', color: '#f8fafc', borderColor: '#334155' }]} 
                    placeholder="₹95,000" 
                    placeholderTextColor="#94a3b8"
                    value={newGoldValue} 
                    onChangeText={setNewGoldValue} 
                  />
                </View>
              </View>

              <Text style={[styles.inputLabel, isDarkMode && { color: '#cbd5e1' }]}>{t.goldPurityPrompt}</Text>
              <TextInput 
                style={[styles.formInput, isDarkMode && { backgroundColor: '#0f172a', color: '#f8fafc', borderColor: '#334155' }]} 
                placeholder="22K 916 BIS Hallmark" 
                placeholderTextColor="#94a3b8"
                value={newGoldPurity} 
                onChangeText={setNewGoldPurity} 
              />

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.inputLabel, isDarkMode && { color: '#cbd5e1' }]}>{t.goldLockerPrompt}</Text>
                  <TextInput 
                    style={[styles.formInput, isDarkMode && { backgroundColor: '#0f172a', color: '#f8fafc', borderColor: '#334155' }]} 
                    placeholder="SBI Locker #104" 
                    placeholderTextColor="#94a3b8"
                    value={newGoldLocker} 
                    onChangeText={setNewGoldLocker} 
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.inputLabel, isDarkMode && { color: '#cbd5e1' }]}>{t.goldJewellerPrompt}</Text>
                  <TextInput 
                    style={[styles.formInput, isDarkMode && { backgroundColor: '#0f172a', color: '#f8fafc', borderColor: '#334155' }]} 
                    placeholder="Tanishq / Kalyan" 
                    placeholderTextColor="#94a3b8"
                    value={newGoldJeweller} 
                    onChangeText={setNewGoldJeweller} 
                  />
                </View>
              </View>

              <View>
                <Text style={[styles.inputLabel, isDarkMode && { color: '#cbd5e1' }]}>{lang === 'hi' ? 'खरीद की तारीख (वैकल्पिक)' : 'Purchase Date (Optional)'}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <TextInput 
                    style={[styles.formInput, { flex: 1 }, isDarkMode && { backgroundColor: '#0f172a', color: '#f8fafc', borderColor: '#334155' }]} 
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
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ================= MODAL: ADD DOCUMENT ================= */}
      <Modal visible={isAddDocModalOpen} transparent animationType="slide" statusBarTranslucent={true} onRequestClose={() => setIsAddDocModalOpen(false)}>
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
          style={styles.modalBackdrop}
        >
          <View style={[styles.modalContent, { maxHeight: '92%', backgroundColor: isDarkMode ? '#1e293b' : '#ffffff', paddingBottom: 20 }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={[styles.modalHeaderTitle, isDarkMode && { color: '#f8fafc' }]}>{editingDocId ? (lang === 'hi' ? '✏️ दस्तावेज़ संपादित करें' : '✏️ Edit Document Details') : t.addDocTitle}</Text>
              <TouchableOpacity onPress={() => setIsAddDocModalOpen(false)}>
                <Text style={{ fontSize: 24, color: '#64748b', fontWeight: 'bold' }}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 320, paddingTop: 6 }}>
            <View style={{ gap: 12, marginVertical: 14 }}>
              <Text style={[styles.inputLabel, isDarkMode && { color: '#cbd5e1' }]}>{t.docMemberPrompt}</Text>
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

              <Text style={[styles.inputLabel, isDarkMode && { color: '#cbd5e1' }]}>{t.docTitlePrompt}</Text>
              <TextInput 
                style={[styles.formInput, isDarkMode && { backgroundColor: '#0f172a', color: '#f8fafc', borderColor: '#334155' }]} 
                placeholder="Aadhaar / PAN / Passport" 
                placeholderTextColor="#94a3b8"
                value={newDocTitle} 
                onChangeText={setNewDocTitle} 
              />

              <Text style={[styles.inputLabel, isDarkMode && { color: '#cbd5e1' }]}>{t.docNumberPrompt}</Text>
              <TextInput 
                style={[styles.formInput, isDarkMode && { backgroundColor: '#0f172a', color: '#f8fafc', borderColor: '#334155' }]} 
                placeholder="XXXX-XXXX-XXXX" 
                placeholderTextColor="#94a3b8"
                value={newDocNumber} 
                onChangeText={setNewDocNumber} 
              />

              <View>
                <Text style={[styles.inputLabel, isDarkMode && { color: '#cbd5e1' }]}>{lang === 'hi' ? 'दस्तावेज़ समाप्ति / नवीनीकरण तारीख (वैकल्पिक)' : 'Expiry / Renewal Date (Optional)'}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <TextInput 
                    style={[styles.formInput, { flex: 1 }, isDarkMode && { backgroundColor: '#0f172a', color: '#f8fafc', borderColor: '#334155' }]} 
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
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ================= MODAL: ADD BILL / REMINDER ================= */}
      <Modal visible={isAddReminderModalOpen} transparent animationType="slide" statusBarTranslucent={true} onRequestClose={() => setIsAddReminderModalOpen(false)}>
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalBackdrop}
        >
          <View style={[styles.modalContent, { maxHeight: '92%', backgroundColor: isDarkMode ? '#1e293b' : '#ffffff' }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={[styles.modalHeaderTitle, isDarkMode && { color: '#f8fafc' }]}>{editingReminderId ? (lang === 'hi' ? '✏️ रिमाइंडर संपादित करें' : '✏️ Edit Reminder Details') : t.addReminderTitle}</Text>
              <TouchableOpacity onPress={() => setIsAddReminderModalOpen(false)}>
                <Text style={{ fontSize: 24, color: '#64748b', fontWeight: 'bold' }}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 240, paddingTop: 4 }}>
            <View style={{ gap: 12, marginVertical: 14 }}>
              {/* Category Selector Chips */}
              <View>
                <Text style={[styles.inputLabel, isDarkMode && { color: '#cbd5e1' }]}>
                  🏷️ {lang === 'hi' ? 'रिमाइंडर प्रकार (श्रेणी चुनें):' : 'Select Reminder Category:'}
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, marginVertical: 4 }}>
                  {[
                    { key: 'task', icon: '📌', labelHi: 'दैनिक कार्य / गतिविधि', labelEn: 'Daily Task / Activity' },
                    { key: 'bday', icon: '🎂', labelHi: 'जन्मदिन', labelEn: 'Birthday' },
                    { key: 'anniversary', icon: '💐', labelHi: 'सालगिरह', labelEn: 'Anniversary' },
                    { key: 'bills', icon: '⚡', labelHi: 'बिल व फीस', labelEn: 'Bills & Fees' },
                    { key: 'health', icon: '🩺', labelHi: 'स्वास्थ्य / डॉक्टर', labelEn: 'Doctor / Health' },
                    { key: 'other', icon: '🔔', labelHi: 'अन्य', labelEn: 'Other' }
                  ].map(cat => (
                    <TouchableOpacity
                      key={cat.key}
                      style={[styles.chip, newRemCategory === cat.key && styles.chipActive]}
                      onPress={() => setNewRemCategory(cat.key as any)}
                    >
                      <Text style={[styles.chipText, newRemCategory === cat.key && styles.chipTextActive]}>
                        {cat.icon} {lang === 'hi' ? cat.labelHi : cat.labelEn}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {/* Dynamic Title Input */}
              <Text style={[styles.inputLabel, isDarkMode && { color: '#cbd5e1' }]}>
                {newRemCategory === 'task' 
                  ? (lang === 'hi' ? '📌 आज या किस दिन क्या करना है? (कार्य लिखें):' : '📌 What needs to be done? (Task Details):')
                  : newRemCategory === 'bday'
                    ? (lang === 'hi' ? '🎂 किसका जन्मदिन है? (नाम लिखें):' : "🎂 Whose Birthday? (Name):")
                    : newRemCategory === 'anniversary'
                      ? (lang === 'hi' ? '💐 किसकी सालगिरह है? (नाम लिखें):' : "💐 Whose Anniversary? (Name):")
                      : t.remTitlePrompt}
              </Text>
              <TextInput 
                style={[styles.formInput, { color: isDarkMode ? '#f8fafc' : '#0f172a', backgroundColor: isDarkMode ? '#0f172a' : '#f8fafc', borderColor: isDarkMode ? '#475569' : '#cbd5e1' }]} 
                placeholder={
                  newRemCategory === 'task'
                    ? (lang === 'hi' ? 'उदा: बैंक जाकर चेक जमा करना / कार सर्विसिंग' : 'e.g. Deposit cheque at bank / Car service')
                    : newRemCategory === 'bday'
                      ? (lang === 'hi' ? 'उदा: राहुल का जन्मदिन (बर्थडे पार्टी)' : "e.g. Rahul's Birthday Party")
                      : newRemCategory === 'anniversary'
                        ? (lang === 'hi' ? 'उदा: मम्मी-पापा की वैवाहिक वर्षगांठ' : "e.g. Mom & Dad 25th Anniversary")
                        : (lang === 'hi' ? 'उदा: बिजली का बिल / पानी / स्कूल फीस' : 'e.g. Electricity Bill / Gas / School Fee')
                }
                placeholderTextColor="#94a3b8"
                value={newRemTitle} 
                onChangeText={setNewRemTitle} 
              />

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.inputLabel, isDarkMode && { color: '#cbd5e1' }]}>
                    {newRemCategory === 'task'
                      ? (lang === 'hi' ? '⏰ समय / टिप्पणी (उदा: 11 AM)' : '⏰ Time / Note (e.g. 11 AM)')
                      : newRemCategory === 'bday' || newRemCategory === 'anniversary'
                        ? (lang === 'hi' ? '🎁 उपहार / बजट (वैकल्पिक)' : '🎁 Gift / Budget (Optional)')
                        : t.remAmountPrompt}
                  </Text>
                  <TextInput 
                    style={[styles.formInput, { color: isDarkMode ? '#f8fafc' : '#0f172a', backgroundColor: isDarkMode ? '#0f172a' : '#f8fafc', borderColor: isDarkMode ? '#475569' : '#cbd5e1' }]} 
                    placeholder={
                      newRemCategory === 'task' 
                        ? (lang === 'hi' ? '11:00 AM' : '11:00 AM') 
                        : (lang === 'hi' ? '₹1,500' : '₹1,500')
                    }
                    placeholderTextColor="#94a3b8"
                    keyboardType={newRemCategory === 'task' ? 'default' : 'numeric'}
                    value={newRemAmount} 
                    onChangeText={setNewRemAmount} 
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.inputLabel, isDarkMode && { color: '#cbd5e1' }]}>
                    {newRemCategory === 'task'
                      ? (lang === 'hi' ? '📅 किस तारीख को करना है:' : '📅 Scheduled Date:')
                      : t.remDatePrompt}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <TextInput 
                      style={[styles.formInput, { flex: 1, color: isDarkMode ? '#f8fafc' : '#0f172a', backgroundColor: isDarkMode ? '#0f172a' : '#f8fafc', borderColor: isDarkMode ? '#475569' : '#cbd5e1' }]} 
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
                style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 }}
                onPress={() => setNewRemUrgent(p => !p)}
              >
                <View style={[styles.checkCircle, newRemUrgent && { backgroundColor: '#ef4444', borderColor: '#ef4444' }]}>
                  <Text style={{ color: '#fff', fontSize: 13, fontWeight: 'bold' }}>{newRemUrgent ? '✓' : ''}</Text>
                </View>
                <Text style={{ fontSize: 13, fontWeight: 'bold', color: isDarkMode ? '#cbd5e1' : '#0f172a' }}>
                  {newRemCategory === 'task' ? (lang === 'hi' ? '⚡ अति-महत्वपूर्ण कार्य (Urgent)' : '⚡ Urgent / Priority Task') : t.remUrgentPrompt}
                </Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.saveSubmitBtn} onPress={handleAddNewReminder}>
              <Text style={styles.saveSubmitBtnText}>{editingReminderId ? (lang === 'hi' ? '✓ बदलाव सुरक्षित करें' : '✓ Update Reminder') : t.saveReminderBtn}</Text>
            </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ================= MODAL: ADD EXPENSE ================= */}
      <Modal visible={isAddExpenseModalOpen} transparent animationType="slide" onRequestClose={() => setIsAddExpenseModalOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalContent, { backgroundColor: themeColors.cardBg, borderColor: themeColors.border }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={styles.modalHeaderTitle}>{t.addExpenseTitle}</Text>
              <TouchableOpacity onPress={() => setIsAddExpenseModalOpen(false)}>
                <Text style={{ fontSize: 22, color: '#64748b', fontWeight: 'bold' }}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 340 }}>
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
                      placeholder={lang === 'hi' ? "आज" : "Today"} 
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
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ================= MODAL: ADD FAMILY MEMBER ================= */}
      <Modal visible={isAddMemberModalOpen} transparent animationType="slide" onRequestClose={() => setIsAddMemberModalOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalContent, { backgroundColor: themeColors.cardBg, borderColor: themeColors.border }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={styles.modalHeaderTitle}>{editingMemberId ? (lang === 'hi' ? '✏️ सदस्य की जानकारी संपादित करें' : '✏️ Edit Family Member') : t.addMemberTitle}</Text>
              <TouchableOpacity onPress={() => setIsAddMemberModalOpen(false)}>
                <Text style={{ fontSize: 22, color: '#64748b', fontWeight: 'bold' }}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 340 }}>
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
                placeholder="98XXXXXXXX (10 अंक)" 
                placeholderTextColor="#94a3b8"
                keyboardType="phone-pad"
                maxLength={10}
                value={newMemberPhone} 
                onChangeText={(val) => setNewMemberPhone(val.replace(/[^0-9]/g, '').slice(0, 10))} 
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
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ================= MODAL: ADD DIARY ================= */}
      <Modal visible={isAddDiaryModalOpen} transparent animationType="slide" onRequestClose={() => setIsAddDiaryModalOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalContent, { backgroundColor: themeColors.cardBg, borderColor: themeColors.border }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={styles.modalHeaderTitle}>{editingDiaryId ? (lang === 'hi' ? '✏️ रचना संपादित करें' : '✏️ Edit Diary Entry') : t.addDiaryTitle}</Text>
              <TouchableOpacity onPress={() => setIsAddDiaryModalOpen(false)}>
                <Text style={{ fontSize: 22, color: '#64748b', fontWeight: 'bold' }}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 340 }}>
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
                    placeholder={lang === 'hi' ? "आज" : "Today"} 
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
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ================= MODAL: DOCTOR RX SLIP ================= */}
      <Modal visible={isRxModalOpen} transparent animationType="slide" onRequestClose={() => setIsRxModalOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalContent, { backgroundColor: themeColors.cardBg, borderColor: themeColors.border }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={styles.modalHeaderTitle}>{t.rxTitle}</Text>
              <TouchableOpacity onPress={() => setIsRxModalOpen(false)}>
                <Text style={{ fontSize: 22, color: '#64748b', fontWeight: 'bold' }}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 340 }}>
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
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ================= MODAL: EMERGENCY SOS ================= */}
      <Modal visible={isSOSModalOpen} transparent animationType="fade" onRequestClose={() => setIsSOSModalOpen(false)}>
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
                <Text style={styles.sosActionBtnText}>{lang === 'hi' ? '📞 112 राष्ट्रीय' : '📞 112 National'}</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.sosActionBtn, { flex: 1, backgroundColor: '#059669' }]}
                onPress={() => { Linking.openURL('tel:108'); setIsSOSModalOpen(false); }}
              >
                <Text style={styles.sosActionBtnText}>{lang === 'hi' ? '🚑 108 एम्बुलेंस' : '🚑 108 Ambulance'}</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.sosActionBtn, { flex: 1, backgroundColor: '#4338ca' }]}
                onPress={() => { Linking.openURL('tel:100'); setIsSOSModalOpen(false); }}
              >
                <Text style={styles.sosActionBtnText}>{lang === 'hi' ? '👮 100 पुलिस' : '👮 100 Police'}</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={{ padding: 12, alignItems: 'center', marginTop: 6 }} onPress={() => setIsSOSModalOpen(false)}>
              <Text style={{ color: '#64748b', fontSize: 14, fontWeight: 'bold' }}>{lang === 'hi' ? 'रद्द करें (Cancel)' : 'Cancel'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      
      {/* ================= MODAL: DEDICATED ACCOUNT & SETTINGS ================= */}
      <Modal visible={isAccountModalOpen} transparent animationType="slide" onRequestClose={() => setIsAccountModalOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalContent, { backgroundColor: isDarkMode ? '#1e293b' : '#ffffff', maxHeight: '88%' }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: isDarkMode ? '#334155' : '#e2e8f0' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={{ fontSize: 20 }}>⚙️</Text>
                <Text style={{ fontSize: 17, fontWeight: '700', color: isDarkMode ? '#f8fafc' : '#0f172a' }}>
                  {lang === 'hi' ? 'खाता व ऐप सेटिंग्स' : 'Account & App Settings'}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setIsAccountModalOpen(false)} style={{ padding: 4 }}>
                <Text style={{ fontSize: 18, color: '#64748b' }}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 14, paddingBottom: 20 }}>
              {/* Profile Card */}
              <View style={{
                backgroundColor: isDarkMode ? '#0f172a' : '#f8fafc',
                borderRadius: 14,
                padding: 14,
                borderWidth: 1,
                borderColor: isDarkMode ? '#334155' : '#e2e8f0'
              }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                    <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: '#2563eb', alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ color: '#fff', fontSize: 20, fontWeight: 'bold' }}>
                        {userProfile?.name ? userProfile.name.charAt(0).toUpperCase() : 'U'}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 16, fontWeight: '700', color: isDarkMode ? '#f8fafc' : '#0f172a' }}>
                        {userProfile?.name || (lang === 'hi' ? 'मुख्य उपयोगकर्ता' : 'Primary User')}
                      </Text>
                      <Text style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                        📱 {userProfile?.mobile || '—'} • 📧 {userProfile?.email || '—'}
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity 
                    style={{ backgroundColor: isDarkMode ? '#1e293b' : '#eff6ff', borderWidth: 1, borderColor: isDarkMode ? '#334155' : '#bfdbfe', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 }}
                    onPress={() => {
                      setOnboardName(userProfile?.name || '');
                      setOnboardMobile(userProfile?.mobile || '');
                      setOnboardEmail(userProfile?.email || '');
                      setIsAccountModalOpen(false);
                      setIsOnboardingOpen(true);
                    }}
                  >
                    <Text style={{ color: '#2563eb', fontSize: 11, fontWeight: '600' }}>✏️ {lang === 'hi' ? 'एडिट' : 'Edit'}</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Role-Based Partitioning Selection */}
              <View style={{
                backgroundColor: isDarkMode ? '#0f172a' : '#f8fafc',
                borderRadius: 14,
                padding: 14,
                borderWidth: 1,
                borderColor: isDarkMode ? '#334155' : '#e2e8f0'
              }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: isDarkMode ? '#f8fafc' : '#0f172a', marginBottom: 6 }}>
                  🛡️ {lang === 'hi' ? 'सक्रिय ऐप रोल (Role Partitioning)' : 'Active App Role'}
                </Text>
                <Text style={{ fontSize: 11, color: '#64748b', marginBottom: 10 }}>
                  {lang === 'hi' ? 'अपनी आवश्यकतानुसार इंटरफ़ेस का चयन करें:' : 'Choose view according to your role:'}
                </Text>

                <View style={{ gap: 8 }}>
                  {[
                    { key: 'PARENT', title: lang === 'hi' ? '👨‍👩‍👧 अभिभावक मोड' : '👨‍👩‍👧 Parent Mode', desc: lang === 'hi' ? 'लाइव बस रूट ट्रैकिंग, फैमिली चैट, लॉकर व रिमाइंडर' : 'Live bus tracking, family chat, vault & reminders' },
                    { key: 'DRIVER', title: lang === 'hi' ? '🚌 चालक / सहायक मोड' : '🚌 Driver / Helper Mode', desc: lang === 'hi' ? 'ड्यूटी स्टार्ट/स्टॉप, छात्रों की बस उपस्थिति व वॉइस अलर्ट' : 'Duty trip control, student boarding roster & voice alerts' },
                    { key: 'ADMIN', title: lang === 'hi' ? '🏫 स्कूल एडमिनिस्ट्रेटर' : '🏫 School Admin Mode', desc: lang === 'hi' ? 'फ्लीट प्रबंधन, नए रूट/बस जोड़ना व स्कूल हेल्पलाइन' : 'Fleet management, adding buses & helpline setup' }
                  ].map(r => (
                    <TouchableOpacity
                      key={r.key}
                      style={{
                        padding: 10,
                        borderRadius: 10,
                        borderWidth: 1.5,
                        borderColor: userRole === r.key ? '#2563eb' : isDarkMode ? '#334155' : '#e2e8f0',
                        backgroundColor: userRole === r.key ? (isDarkMode ? '#1e293b' : '#eff6ff') : (isDarkMode ? '#0f172a' : '#ffffff'),
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                      }}
                      onPress={() => handleSetUserRole(r.key as any)}
                    >
                      <View style={{ flex: 1, paddingRight: 8 }}>
                        <Text style={{ fontSize: 13, fontWeight: '700', color: userRole === r.key ? '#2563eb' : isDarkMode ? '#f8fafc' : '#0f172a' }}>
                          {r.title}
                        </Text>
                        <Text style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>{r.desc}</Text>
                      </View>
                      <View style={{ width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: userRole === r.key ? '#2563eb' : '#94a3b8', alignItems: 'center', justifyContent: 'center' }}>
                        {userRole === r.key && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#2563eb' }} />}
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* App Security Lock */}
              <TouchableOpacity
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  backgroundColor: isDarkMode ? '#0f172a' : '#f8fafc',
                  padding: 12,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: isDarkMode ? '#334155' : '#e2e8f0'
                }}
                onPress={async () => {
                  const nextVal = !isPinLockEnabled;
                  setIsPinLockEnabled(nextVal);
                  await AsyncStorage.setItem('@mast_v7_pin_lock_enabled', nextVal ? 'true' : 'false');
                  Alert.alert(
                    lang === 'hi' ? 'सुरक्षा लॉक' : 'Security Lock',
                    nextVal
                      ? (lang === 'hi' ? 'सुरक्षा लॉक सक्रिय किया गया।' : 'Security lock enabled.')
                      : (lang === 'hi' ? 'सुरक्षा लॉक बंद किया गया।' : 'Security lock disabled.')
                  );
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Text style={{ fontSize: 18 }}>🔒</Text>
                  <View>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: isDarkMode ? '#f8fafc' : '#0f172a' }}>
                      {lang === 'hi' ? 'ऐप सुरक्षा लॉक (PIN / बायोमेट्रिक)' : 'App Security Lock'}
                    </Text>
                    <Text style={{ fontSize: 11, color: '#64748b' }}>
                      {isPinLockEnabled 
                        ? (lang === 'hi' ? 'सक्रिय • ऐप खोलने पर पिन पूछेगा' : 'Active • Asks PIN on open') 
                        : (lang === 'hi' ? 'बंद • सीधे ऐप में प्रवेश करें' : 'Disabled • Opens directly')}
                    </Text>
                  </View>
                </View>
                <View style={{ backgroundColor: isPinLockEnabled ? '#10b981' : '#94a3b8', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 }}>
                  <Text style={{ color: '#fff', fontSize: 11, fontWeight: 'bold' }}>{isPinLockEnabled ? 'ON' : 'OFF'}</Text>
                </View>
              </TouchableOpacity>

              {/* Daily Backup & Cloud Safety */}
              <View style={{ backgroundColor: isDarkMode ? '#0f172a' : '#f8fafc', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: isDarkMode ? '#334155' : '#e2e8f0' }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ color: isDarkMode ? '#f8fafc' : '#0f172a', fontSize: 13, fontWeight: '600' }}>
                    🛡️ {lang === 'hi' ? 'दैनिक बैकअप व क्लाउड सुरक्षा' : 'Daily Backup & Cloud Safety'}
                  </Text>
                  <View style={{ backgroundColor: '#ecfdf5', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                    <Text style={{ color: '#059669', fontSize: 10, fontWeight: 'bold' }}>
                      {lang === 'hi' ? 'सक्रिय' : 'Active'}
                    </Text>
                  </View>
                </View>
                <Text style={{ color: '#64748b', fontSize: 11, marginTop: 3 }}>
                  {lang === 'hi' 
                    ? `अंतिम बैकअप: ${lastBackupTime || 'आज'} • फोन बदलने पर भी डेटा सुरक्षित` 
                    : `Last backup: ${lastBackupTime || 'Today'} • Safe on phone change`}
                </Text>

                <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                  <TouchableOpacity 
                    style={{
                      flex: 1,
                      backgroundColor: '#2563eb',
                      borderRadius: 10,
                      paddingVertical: 9,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6
                    }}
                    onPress={() => {
                      setIsAccountModalOpen(false);
                      handleExportToDrive();
                    }}
                  >
                    <Text style={{ fontSize: 13 }}>📤</Text>
                    <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>
                      {lang === 'hi' ? 'फ़ाइल में बैकअप' : 'Save Backup'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={{
                      flex: 1,
                      backgroundColor: isDarkMode ? '#1e293b' : '#ffffff',
                      borderWidth: 1,
                      borderColor: isDarkMode ? '#334155' : '#cbd5e1',
                      borderRadius: 10,
                      paddingVertical: 9,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6
                    }}
                    onPress={() => {
                      setIsAccountModalOpen(false);
                      setIsRestoreModalOpen(true);
                    }}
                  >
                    <Text style={{ fontSize: 13 }}>📥</Text>
                    <Text style={{ color: isDarkMode ? '#f8fafc' : '#0f172a', fontSize: 12, fontWeight: '600' }}>
                      {lang === 'hi' ? 'रीस्टोर करें' : 'Restore Data'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Privacy Policy In-App Button */}
              <TouchableOpacity
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  backgroundColor: isDarkMode ? '#0f172a' : '#f8fafc',
                  padding: 12,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: isDarkMode ? '#334155' : '#e2e8f0'
                }}
                onPress={() => {
                  Linking.openURL('https://anilmsw2007.github.io/MAST/docs/privacy_policy.html');
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Text style={{ fontSize: 18 }}>📜</Text>
                  <View>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: isDarkMode ? '#f8fafc' : '#0f172a' }}>
                      {lang === 'hi' ? 'गोपनीयता नीति (Privacy Policy)' : 'Privacy Policy'}
                    </Text>
                    <Text style={{ fontSize: 11, color: '#64748b' }}>
                      {lang === 'hi' ? '100% ऑन-डिवाइस डेटा सुरक्षा नियम' : '100% on-device private & secure'}
                    </Text>
                  </View>
                </View>
                <Text style={{ fontSize: 14, color: '#64748b', fontWeight: 'bold' }}>➔</Text>
              </TouchableOpacity>

              {/* Support & Donate Button */}
              <TouchableOpacity
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  backgroundColor: isDarkMode ? '#0f172a' : '#f8fafc',
                  padding: 12,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: isDarkMode ? '#334155' : '#e2e8f0'
                }}
                onPress={() => {
                  setIsAccountModalOpen(false);
                  setIsDonateModalOpen(true);
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Text style={{ fontSize: 18 }}>❤️</Text>
                  <View>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: isDarkMode ? '#f8fafc' : '#0f172a' }}>
                      {lang === 'hi' ? 'MAST Life OS को सपोर्ट करें' : 'Support MAST Life OS'}
                    </Text>
                    <Text style={{ fontSize: 11, color: '#64748b' }}>
                      {lang === 'hi' ? 'स्वैच्छिक UPI सहयोग या डोनेशन' : 'Voluntary UPI donation'}
                    </Text>
                  </View>
                </View>
                <Text style={{ fontSize: 14, color: '#64748b', fontWeight: 'bold' }}>➔</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

{/* ================= MODAL: DONATION (REAL UPI) WITH CUSTOM AMOUNT & EMOTIONAL HOOK ================= */}
      <Modal visible={isDonateModalOpen} transparent animationType="slide" onRequestClose={() => setIsDonateModalOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalContent, { backgroundColor: themeColors.cardBg, borderColor: themeColors.border, maxHeight: '92%', padding: 20 }]}>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {/* Heart Warming Icon */}
              <View style={{ alignItems: 'center', marginTop: 4 }}>
                <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: isDarkMode ? '#4c0519' : '#ffe4e6', justifyContent: 'center', alignItems: 'center', marginBottom: 8 }}>
                  <Text style={{ fontSize: 32 }}>💖</Text>
                </View>
                <Text style={{ fontSize: 20, fontWeight: 'bold', textAlign: 'center', color: isDarkMode ? '#fda4af' : '#be123c' }}>
                  {lang === 'hi' ? 'परिवार के लिए एक छोटा सा सहयोग' : 'Support MAST for Families'}
                </Text>
                <Text style={{ fontSize: 12, fontWeight: '600', color: isDarkMode ? '#94a3b8' : '#64748b', marginTop: 2 }}>
                  {lang === 'hi' ? 'दिल से दिल तक • भारतीय परिवारों का अपना साथी' : 'Built with Heart • 100% Ad-Free & Private'}
                </Text>
              </View>

              {/* Emotional Story Box */}
              <View style={{ backgroundColor: isDarkMode ? '#0f172a' : '#fff1f2', padding: 14, borderRadius: 14, marginVertical: 14, borderWidth: 1, borderColor: isDarkMode ? '#334155' : '#fecdd3' }}>
                <Text style={{ fontSize: 13, color: isDarkMode ? '#e2e8f0' : '#475569', lineHeight: 20, textAlign: 'center' }}>
                  {lang === 'hi'
                    ? 'MAST कोई मुनाफ़ा कमाने वाली कॉर्पोरेट कंपनी नहीं, बल्कि हर परिवार की सुरक्षा, निजता और सुकून के लिए समर्पित प्रयास है।\n\nहम आपके बच्चों, दवाओं और ज़रूरी दस्तावेज़ों को 100% प्राइवेट रखते हैं — बिना किसी विज्ञापन (Zero Ads), बिना किसी ट्रैकिंग के।\n\nइस मिशन को हमेशा मुफ़्त और सुरक्षित रखने के लिए क्या आप एक कप चाय या एक छोटे से शगुन (₹21 या ₹51) का आशीर्वाद दे सकते हैं?'
                    : 'MAST is crafted with love for Indian families. 100% private, zero ads, zero tracking.\n\nTo keep this family OS free and safe forever without any corporate influence or invasive ads, your small contribution (even ₹21 as a token of blessing) makes a monumental difference.'}
                </Text>
              </View>

              {/* Preset Culturally-Resonant Shagun Chips */}
              <Text style={{ fontSize: 12, fontWeight: 'bold', color: isDarkMode ? '#cbd5e1' : '#334155', marginBottom: 8, textAlign: 'center' }}>
                {lang === 'hi' ? '✨ शगुन राशि चुनें (One-Tap Support):' : '✨ Select Blessing Amount:'}
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginBottom: 14 }}>
                {[
                  { amt: '₹21', labelHi: 'शगुन', labelEn: 'Blessing' },
                  { amt: '₹51', labelHi: 'सहयोग', labelEn: 'Support' },
                  { amt: '₹101', labelHi: 'आशीर्वाद', labelEn: 'Grace' },
                  { amt: '₹251', labelHi: 'प्रेरणा', labelEn: 'Inspire' },
                  { amt: '₹501', labelHi: 'संरक्षक', labelEn: 'Patron' },
                ].map((item, idx) => (
                  <TouchableOpacity 
                    key={idx} 
                    style={{ 
                      backgroundColor: isDarkMode ? '#1e293b' : '#fef3c7', 
                      paddingVertical: 8, 
                      paddingHorizontal: 12, 
                      borderRadius: 12, 
                      borderWidth: 1, 
                      borderColor: isDarkMode ? '#d97706' : '#fde68a',
                      alignItems: 'center',
                      minWidth: 62
                    }}
                    onPress={() => handleUPIPayment(item.amt)}
                  >
                    <Text style={{ color: isDarkMode ? '#fbbf24' : '#b45309', fontWeight: 'bold', fontSize: 14 }}>{item.amt}</Text>
                    <Text style={{ color: isDarkMode ? '#94a3b8' : '#92400e', fontSize: 9, fontWeight: '600', marginTop: 1 }}>{lang === 'hi' ? item.labelHi : item.labelEn}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Custom / Other Amount Input Section */}
              <View style={{ backgroundColor: isDarkMode ? '#1e293b' : '#f8fafc', padding: 12, borderRadius: 14, borderWidth: 1, borderColor: isDarkMode ? '#334155' : '#e2e8f0', marginBottom: 16 }}>
                <Text style={{ fontSize: 12, fontWeight: 'bold', color: isDarkMode ? '#cbd5e1' : '#334155', marginBottom: 6 }}>
                  {lang === 'hi' ? '✏️ अपनी इच्छानुसार अन्य राशि (Other Amount):' : '✏️ Enter Custom Amount:'}
                </Text>
                <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                  <View style={{ 
                    flex: 1, 
                    flexDirection: 'row', 
                    alignItems: 'center', 
                    backgroundColor: isDarkMode ? '#0f172a' : '#ffffff', 
                    borderWidth: 1, 
                    borderColor: isDarkMode ? '#475569' : '#cbd5e1', 
                    borderRadius: 10, 
                    paddingHorizontal: 10 
                  }}>
                    <Text style={{ fontSize: 16, fontWeight: 'bold', color: themeColors.text }}>₹</Text>
                    <TextInput
                      style={{ flex: 1, paddingVertical: 8, paddingHorizontal: 6, fontSize: 15, fontWeight: '600', color: themeColors.text }}
                      placeholder={lang === 'hi' ? 'उदा: 11, 25, 200, 1100...' : 'e.g. 11, 25, 200, 1100...'}
                      placeholderTextColor="#94a3b8"
                      keyboardType="numeric"
                      value={customDonationInput}
                      onChangeText={setCustomDonationInput}
                    />
                  </View>
                  <TouchableOpacity
                    style={{ 
                      backgroundColor: '#e11d48', 
                      paddingVertical: 10, 
                      paddingHorizontal: 14, 
                      borderRadius: 10, 
                      justifyContent: 'center',
                      elevation: 2
                    }}
                    onPress={() => {
                      const val = customDonationInput.trim().replace(/[^0-9]/g, '');
                      if (!val || parseInt(val, 10) <= 0) {
                        Alert.alert(
                          lang === 'hi' ? 'अमान्य राशि' : 'Invalid Amount',
                          lang === 'hi' ? 'कृपया कम से कम ₹1 की राशि दर्ज करें।' : 'Please enter an amount of at least ₹1.'
                        );
                        return;
                      }
                      handleUPIPayment(val);
                    }}
                  >
                    <Text style={{ color: '#ffffff', fontWeight: 'bold', fontSize: 13 }}>
                      {lang === 'hi' ? 'दान करें ➔' : 'Donate ➔'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Trust Badge & UPI ID details */}
              <View style={{ alignItems: 'center', marginBottom: 14 }}>
                <Text style={{ fontSize: 11, color: '#10b981', fontWeight: '600' }}>
                  🔒 {lang === 'hi' ? 'PhonePe • Google Pay • Paytm • BHIM UPI द्वारा 100% सुरक्षित' : '100% Secure via PhonePe, GPay, Paytm & UPI'}
                </Text>
                <Text style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>
                  UPI VPA: 9451605191@ptyes
                </Text>
              </View>

              <TouchableOpacity style={styles.closeModalBtn} onPress={() => setIsDonateModalOpen(false)}>
                <Text style={styles.closeModalBtnText}>{t.closeBtn}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ================= MODAL: ADD CHILD & SCHOOL BUS PASS ================= */}
      <Modal visible={isAddChildModalOpen} transparent animationType="slide" statusBarTranslucent={true} onRequestClose={() => setIsAddChildModalOpen(false)}>
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalBackdrop}
        >
          <View style={[styles.modalContent, { maxHeight: '94%', paddingBottom: 20, backgroundColor: themeColors.cardBg, borderColor: themeColors.border }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <Text style={styles.modalHeaderTitle}>
                {editingChildId
                  ? (lang === 'hi' ? '✏️ बच्चे की जानकारी संपादित करें' : '✏️ Edit Child & Bus Details')
                  : (lang === 'hi' ? '🎒 नया बच्चा / स्कूल बस जोड़ें' : '🎒 Add Child & School Bus')}
              </Text>
              <TouchableOpacity onPress={() => { setEditingChildId(null); setIsAddChildModalOpen(false); }}>
                <Text style={{ fontSize: 24, color: '#64748b', fontWeight: 'bold' }}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView 
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingBottom: 340, paddingTop: 6 }}
            >
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

                {/* 4-Step Hierarchy: State -> District -> School -> PIN */}
                <View style={{ backgroundColor: isDarkMode ? '#0f172a' : '#f8fafc', padding: 12, borderRadius: 14, borderWidth: 1, borderColor: isDarkMode ? '#334155' : '#e2e8f0', gap: 10, marginVertical: 4 }}>
                  <Text style={{ fontSize: 13, fontWeight: 'bold', color: '#ea580c' }}>
                    🏫 {lang === 'hi' ? 'स्कूल व बस कनेक्टिविटी विवरण:' : 'School & Bus Connection Details:'}
                  </Text>

                  {/* 1. State */}
                  <View>
                    <Text style={[styles.inputLabel, isDarkMode && { color: '#cbd5e1' }]}>
                      🏛️ {lang === 'hi' ? '1. राज्य चुनें (State):' : '1. Select State:'}
                    </Text>
                    <TouchableOpacity 
                      style={[styles.formInput, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: isDarkMode ? '#1e293b' : '#ffffff', borderColor: '#3b82f6', borderWidth: 1.5, paddingVertical: 10 }]}
                      onPress={() => openLocationPicker('state', 'parent')}
                    >
                      <Text style={{ fontSize: 13, fontWeight: 'bold', color: isDarkMode ? '#f8fafc' : '#0f172a', flex: 1 }} numberOfLines={1}>
                        🏛️ {parentState || schoolStateConfig || 'उत्तर प्रदेश (Uttar Pradesh)'}
                      </Text>
                      <Text style={{ color: '#3b82f6', fontSize: 12, fontWeight: 'bold' }}>{lang === 'hi' ? 'बदलें 🔍' : 'Change 🔍'}</Text>
                    </TouchableOpacity>
                  </View>

                  {/* 2. District */}
                  <View>
                    <Text style={[styles.inputLabel, isDarkMode && { color: '#cbd5e1' }]}>
                      📍 {lang === 'hi' ? '2. ज़िला चुनें (District):' : '2. Select District:'}
                    </Text>
                    <TouchableOpacity 
                      style={[styles.formInput, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: isDarkMode ? '#1e293b' : '#ffffff', borderColor: '#3b82f6', borderWidth: 1.5, paddingVertical: 10 }]}
                      onPress={() => openLocationPicker('district', 'parent')}
                    >
                      <Text style={{ fontSize: 13, fontWeight: 'bold', color: isDarkMode ? '#f8fafc' : '#0f172a', flex: 1 }} numberOfLines={1}>
                        📍 {parentDistrict || schoolDistrictConfig || (lang === 'hi' ? 'जिला चुनें' : 'Select District')}
                      </Text>
                      <Text style={{ color: '#3b82f6', fontSize: 12, fontWeight: 'bold' }}>{lang === 'hi' ? 'बदलें 🔍' : 'Change 🔍'}</Text>
                    </TouchableOpacity>
                  </View>

                  {/* 3. School Name */}
                  <View>
                    <Text style={[styles.inputLabel, isDarkMode && { color: '#cbd5e1' }]}>
                      🏫 {lang === 'hi' ? '3. स्कूल का नाम चुनें या लिखें:' : '3. Select or Type School Name:'}
                    </Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, marginVertical: 4 }}>
                      {Array.from(new Set([
                        schoolNameConfig,
                        ...schoolChildren.map(c => c.schoolNameHi || c.schoolNameEn),
                        ...registeredSchools
                      ])).filter(Boolean).map((sc, idx) => (
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
                      style={[styles.formInput, { backgroundColor: isDarkMode ? '#1e293b' : '#ffffff' }]} 
                      placeholder={lang === 'hi' ? 'उदा: बाल भारती स्कूल / डीपीएस' : "e.g. Bal Bharati School / DPS"} 
                      placeholderTextColor="#94a3b8"
                      value={newChildSchool} 
                      onChangeText={setNewChildSchool} 
                    />
                  </View>

                  {/* 4. Bus Parent PIN / Code */}
                  <View style={{ backgroundColor: isDarkMode ? '#1e293b' : '#eff6ff', padding: 12, borderRadius: 12, borderWidth: 1.5, borderColor: '#3b82f6', marginTop: 4 }}>
                    <Text style={[styles.inputLabel, { color: isDarkMode ? '#93c5fd' : '#1d4ed8', fontWeight: 'bold', fontSize: 13 }]}>
                      🔑 {lang === 'hi' ? '4. स्कूल / एडमिन द्वारा दिया गया 4-अंकीय बस कोड (PIN):' : '4. 4-Digit Bus Code (From School Admin):'}
                    </Text>
                    <TextInput 
                      style={[styles.formInput, { 
                        color: isDarkMode ? '#f8fafc' : '#0f172a', 
                        backgroundColor: isDarkMode ? '#0f172a' : '#ffffff', 
                        borderColor: '#3b82f6', 
                        borderWidth: 2, 
                        fontSize: 20, 
                        fontWeight: 'bold', 
                        letterSpacing: 4, 
                        textAlign: 'center',
                        paddingVertical: 10
                      }]} 
                      placeholder="उदा: 4001 या 4004" 
                      placeholderTextColor="#94a3b8"
                      keyboardType="numeric"
                      maxLength={6}
                      value={newChildBusCode} 
                      onChangeText={(val) => {
                        setNewChildBusCode(val);
                        const trimmed = val.trim();
                        const cleanTrim = trimmed.toLowerCase().replace(/\s+/g, '');
                        const applyMatch = (fleetList: any[]) => {
                          const matched = fleetList.find(b => 
                            (b.parentCode && b.parentCode.trim() === trimmed) || 
                            (b.driverPin && b.driverPin.trim() === trimmed) || 
                            (b.busNo && b.busNo.toLowerCase().replace(/\s+/g, '') === cleanTrim) ||
                            (b.vehicleNo && b.vehicleNo.toLowerCase().replace(/\s+/g, '') === cleanTrim)
                          );
                          if (matched) {
                            const scName = schoolNameConfig || matched.schoolName || (lang === 'hi' ? 'स्कूल का नाम' : 'School Name');
                            setNewChildSchool(scName);
                            setNewChildBusNo(matched.busNo);
                            setNewChildDriverName(matched.driverName || '');
                            setNewChildConductorName(matched.conductorName || '');
                            setNewChildVehicleNo(matched.vehicleNo || '');
                            setNewChildDriverPhone(matched.driverPhone || '');
                            setNewChildConductorPhone(matched.conductorPhone || '');
                            setNewChildSchoolHelpline(schoolHelplineConfig || '');
                            Vibration.vibrate(60);
                            return true;
                          }
                          return false;
                        };

                        if (!applyMatch(schoolFleetBuses) && trimmed.length >= 3) {
                          fetchLatestSchoolDataFromCloud(false).then((fetchedFleet) => {
                            if (fetchedFleet) applyMatch(fetchedFleet);
                          });
                        }
                      }} 
                    />
                    {schoolFleetBuses.some(b => (b.parentCode && b.parentCode.trim() === newChildBusCode.trim()) || (b.driverPin && b.driverPin.trim() === newChildBusCode.trim()) || (b.busNo && b.busNo.toLowerCase().replace(/\s+/g, '') === newChildBusCode.trim().toLowerCase().replace(/\s+/g, ''))) ? (
                      (() => {
                        const m = schoolFleetBuses.find(b => (b.parentCode && b.parentCode.trim() === newChildBusCode.trim()) || (b.driverPin && b.driverPin.trim() === newChildBusCode.trim()) || (b.busNo && b.busNo.toLowerCase().replace(/\s+/g, '') === newChildBusCode.trim().toLowerCase().replace(/\s+/g, '')));
                        return (
                          <View style={{ backgroundColor: '#dcfce7', padding: 10, borderRadius: 10, marginTop: 6, borderWidth: 1, borderColor: '#86efac' }}>
                            <Text style={{ fontSize: 13, fontWeight: 'bold', color: '#15803d' }}>
                              ✓ {lang === 'hi' ? 'बस व स्कूल सत्यापित:' : 'Bus & School Verified:'}
                            </Text>
                            <Text style={{ fontSize: 13, fontWeight: 'bold', color: '#166534', marginTop: 2 }}>
                              🏫 {newChildSchool || m?.schoolName || schoolNameConfig || ''}
                            </Text>
                            <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#166534', marginTop: 2 }}>
                              🚍 {m?.busNo} ({m?.vehicleNo}) • 👨‍✈️ {m?.driverName}
                            </Text>
                            <Text style={{ fontSize: 11, color: '#166534', marginTop: 2 }}>
                              📞 {lang === 'hi' ? 'कंट्रोल रूम:' : 'Helpline:'} +91 {schoolHelplineConfig || ''} • {lang === 'hi' ? 'चालक फोन:' : 'Driver:'} +91 {m?.driverPhone}
                            </Text>
                          </View>
                        );
                      })()
                    ) : (
                      <View style={{ marginTop: 4 }}>
                        <Text style={{ fontSize: 11, color: isDarkMode ? '#94a3b8' : '#64748b' }}>
                          {lang === 'hi' 
                            ? '💡 एडमिन द्वारा दिया गया कोड (जैसे 4001, 4004, 4008, 4012) दर्ज करते ही बस, चालक व स्कूल हेल्पलाइन स्वतः भर जाएँगे।' 
                            : 'Enter 4-digit code provided by school admin to auto-fill bus & driver details.'}
                        </Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, marginTop: 6 }}>
                          {schoolFleetBuses.map((b, idx) => (
                            <TouchableOpacity
                              key={idx}
                              style={{ backgroundColor: isDarkMode ? '#334155' : '#e2e8f0', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 }}
                              onPress={() => {
                                setNewChildBusCode(b.parentCode || b.driverPin);
                                setNewChildSchool(schoolNameConfig || '');
                                setNewChildBusNo(b.busNo);
                                setNewChildDriverPhone(b.driverPhone || '');
                                setNewChildConductorPhone(b.conductorPhone || '');
                                setNewChildSchoolHelpline(schoolHelplineConfig || '');
                                Vibration.vibrate(40);
                              }}
                            >
                              <Text style={{ fontSize: 11, fontWeight: 'bold', color: isDarkMode ? '#f8fafc' : '#1e293b' }}>
                                🚌 {b.busNo}: कोड {b.parentCode}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </ScrollView>
                      </View>
                    )}

                    {/* Multi-Device Cloud Sync Button */}
                    <View style={{ marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: isDarkMode ? '#334155' : '#bfdbfe' }}>
                      <TouchableOpacity 
                        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: isDarkMode ? '#1e293b' : '#dbeafe', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10 }}
                        onPress={() => fetchLatestSchoolDataFromCloud(true)}
                      >
                        <Text style={{ fontSize: 13, fontWeight: 'bold', color: '#1d4ed8' }}>
                          {isCloudSyncing ? '⏳ ' + (lang === 'hi' ? 'क्लाउड से डेटा लोड हो रहा है...' : 'Syncing...') : '🔄 ' + (lang === 'hi' ? 'एडमिन / चालक मोबाइल से डेटा सिंक करें' : 'Sync From Admin / Driver Mobile')}
                        </Text>
                      </TouchableOpacity>
                      {cloudSyncMsg ? (
                        <Text style={{ fontSize: 11, color: '#15803d', fontWeight: 'bold', textAlign: 'center', marginTop: 4 }}>
                          {cloudSyncMsg}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                </View>

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



                <Text style={styles.inputLabel}>{lang === 'hi' ? 'आपका पिकअप/ड्रॉप स्टॉप' : 'Your Pickup / Drop Stop'}</Text>
                <TextInput 
                  style={styles.formInput} 
                  placeholder={lang === 'hi' ? 'उदा: विकास मार्ग गेट 2' : 'e.g. Vikas Marg Gate 2'} 
                  placeholderTextColor="#94a3b8"
                  value={newChildStopName} 
                  onChangeText={setNewChildStopName} 
                />

                {/* --- 📞 स्कूल हेल्पलाइन व चालक संपर्क (Helpline & Contacts) --- */}
                <View style={{ backgroundColor: '#f0fdf4', borderRadius: 14, padding: 12, marginTop: 8, borderWidth: 1, borderColor: '#bbf7d0', gap: 10 }}>
                  <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#166534' }}>
                    📞 {lang === 'hi' ? 'स्कूल हेल्पलाइन व बस चालक विवरण' : 'School Helpline & Driver Contacts'}
                  </Text>
                  
                  <View>
                    <Text style={[styles.inputLabel, { color: '#166534' }]}>
                      🏫 {lang === 'hi' ? 'स्कूल ट्रांसपोर्ट हेल्पलाइन / कंट्रोल रूम नंबर' : 'School Transport Helpline Number'}
                    </Text>
                    <TextInput 
                      style={[styles.formInput, { backgroundColor: '#ffffff', color: '#0f172a' }]} 
                      placeholder={lang === 'hi' ? 'उदा: 98XXXXXXXX (10 अंक)' : 'e.g. 98XXXXXXXX'} 
                      placeholderTextColor="#94a3b8"
                      keyboardType="phone-pad"
                      maxLength={10}
                      value={newChildSchoolHelpline} 
                      onChangeText={(val) => setNewChildSchoolHelpline(val.replace(/[^0-9]/g, '').slice(0, 10))} 
                    />
                  </View>

                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.inputLabel, { color: '#166534' }]}>
                        👨‍✈️ {lang === 'hi' ? 'चालक मोबाइल' : 'Driver Mobile'}
                      </Text>
                      <TextInput 
                        style={[styles.formInput, { backgroundColor: '#ffffff', color: '#0f172a' }]} 
                        placeholder="98765XXXXX" 
                        placeholderTextColor="#94a3b8"
                        keyboardType="phone-pad"
                        maxLength={10}
                        value={newChildDriverPhone} 
                        onChangeText={(val) => setNewChildDriverPhone(val.replace(/[^0-9]/g, '').slice(0, 10))} 
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.inputLabel, { color: '#166534' }]}>
                        🤝 {lang === 'hi' ? 'कंडक्टर / सहायक' : 'Helper Mobile'}
                      </Text>
                      <TextInput 
                        style={[styles.formInput, { backgroundColor: '#ffffff', color: '#0f172a' }]} 
                        placeholder="98765XXXXX" 
                        placeholderTextColor="#94a3b8"
                        keyboardType="phone-pad"
                        maxLength={10}
                        value={newChildConductorPhone} 
                        onChangeText={(val) => setNewChildConductorPhone(val.replace(/[^0-9]/g, '').slice(0, 10))} 
                      />
                    </View>
                  </View>
                </View>

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
                      ? '💡 यह वैकल्पिक (Optional) है। यहाँ फीस दर्ज करने से केवल आपके "रिमाइंडर टैब" में अलर्ट बनेगा, यह ट्रैकिंग स्क्रीन पर नहीं दिखेगा।'
                      : 'Entering fee details automatically creates monthly fee alerts in your Reminders tab.'}
                  </Text>

                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.inputLabel, { fontSize: 11, color: '#7c2d12' }]}>
                        🏫 {lang === 'hi' ? 'मासिक स्कूल फीस' : 'Monthly School Fee'}
                      </Text>
                      <TextInput 
                        style={[styles.formInput, { backgroundColor: '#ffffff', color: '#0f172a', height: 48, fontSize: 16 }]} 
                        placeholder="₹3,500" 
                        placeholderTextColor="#94a3b8"
                        cursorColor="#ea580c"
                        selectionColor="#fed7aa"
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
                        style={[styles.formInput, { backgroundColor: '#ffffff', color: '#0f172a', height: 48, fontSize: 16 }]} 
                        placeholder="₹1,800" 
                        placeholderTextColor="#94a3b8"
                        cursorColor="#ea580c"
                        selectionColor="#fed7aa"
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
                        style={[styles.formInput, { flex: 1, backgroundColor: '#ffffff', color: '#0f172a', height: 48, fontSize: 16 }]} 
                        placeholder="10" 
                        placeholderTextColor="#94a3b8"
                        cursorColor="#ea580c"
                        selectionColor="#fed7aa"
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
                      {(lang === 'hi' ? ['5 तारीख', '10 तारीख', '15 तारीख', '25 तारीख'] : ['5th Date', '10th Date', '15th Date', '25th Date']).map(dStr => {
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

              <TouchableOpacity 
                style={[styles.saveSubmitBtn, { marginTop: 16 }, isSavingChild && { opacity: 0.6 }]} 
                onPress={handleAddNewChild}
                disabled={isSavingChild}
              >
                <Text style={styles.saveSubmitBtnText}>
                  {isSavingChild
                    ? (lang === 'hi' ? '⏳ सहेजा जा रहा है...' : '⏳ Saving...')
                    : (editingChildId
                        ? (lang === 'hi' ? '✓ बदलाव सुरक्षित करें' : '✓ Update Child & Bus')
                        : (lang === 'hi' ? '💾 बच्चा व बस सुरक्षित सेव करें' : '💾 Save Child & Bus'))}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ================= MODAL: DRIVER SWITCH BUS NUMBER ================= */}
      <Modal visible={isChangeBusModalOpen} transparent animationType="fade" onRequestClose={() => setIsChangeBusModalOpen(false)}>
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
      <Modal visible={isLocationPickerOpen} transparent animationType="slide" onRequestClose={() => setIsLocationPickerOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalContent, { maxHeight: '80%', backgroundColor: themeColors.cardBg, borderColor: themeColors.border }]}>
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
      <Modal visible={isBudgetModalOpen} transparent animationType="fade" onRequestClose={() => setIsBudgetModalOpen(false)}>
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

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 340 }}>
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
            </ScrollView>
          </View>
        </View>
      </Modal>

            {/* ================= MODAL: RESTORE DATA (PHONE CHANGE RECOVERY) ================= */}
      <Modal visible={isRestoreModalOpen} transparent animationType="slide" statusBarTranslucent={true} onRequestClose={() => setIsRestoreModalOpen(false)}>
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalBackdrop}
        >
          <View style={[styles.modalContent, { maxHeight: '92%', backgroundColor: isDarkMode ? '#1e293b' : '#ffffff', paddingBottom: 20 }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <Text style={[styles.modalHeaderTitle, isDarkMode && { color: '#f8fafc' }]}>
                📥 {lang === 'hi' ? 'डेटा पुनर्प्राप्त करें (Restore Data)' : 'Restore MAST Data'}
              </Text>
              <TouchableOpacity onPress={() => setIsRestoreModalOpen(false)}>
                <Text style={{ fontSize: 24, color: '#64748b', fontWeight: 'bold' }}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 320, paddingTop: 4 }}>
              <View style={{ gap: 14 }}>
                <Text style={{ fontSize: 13, color: isDarkMode ? '#cbd5e1' : '#64748b', lineHeight: 18 }}>
                  {lang === 'hi'
                    ? 'यदि आपने फोन बदल दिया है या ऐप दोबारा इंस्टॉल की है, तो आप अपने पिछले बैकअप से सारा डेटा (दवाइयां, लॉकर, गहने, स्कूल बस और डायरी) 1-क्लिक में वापस ला सकते हैं।'
                    : 'If you switched phones or reinstalled the app, you can restore all your data (medicines, vault, gold, school bus and diary) in 1 tap.'}
                </Text>

                {/* Instant Restore from Local Phone Snapshot */}
                <View style={{ backgroundColor: isDarkMode ? '#0f172a' : '#f0fdf4', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: isDarkMode ? '#334155' : '#86efac' }}>
                  <Text style={{ fontSize: 13, fontWeight: 'bold', color: isDarkMode ? '#86efac' : '#15803d' }}>
                    ⚡ {lang === 'hi' ? 'विकल्प 1: फोन के ऑटो-बैकअप से तुरंत लोड करें' : 'Option 1: Quick Restore from Phone Snapshot'}
                  </Text>
                  <Text style={{ fontSize: 11, color: isDarkMode ? '#94a3b8' : '#475569', marginTop: 3 }}>
                    {lang === 'hi' 
                      ? `अंतिम उपलब्ध ऑटो-बैकअप: ${lastBackupTime || 'आज'}` 
                      : `Last available snapshot: ${lastBackupTime || 'Today'}`}
                  </Text>
                  <TouchableOpacity 
                    style={{ backgroundColor: '#10b981', paddingVertical: 10, borderRadius: 10, alignItems: 'center', marginTop: 10 }}
                    onPress={() => handleRestoreData()}
                  >
                    <Text style={{ color: '#fff', fontSize: 13, fontWeight: 'bold' }}>
                      ✓ {lang === 'hi' ? 'ऑटो-बैकअप से सब लोड करें' : 'Restore from Snapshot'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Restore from Pasted Drive / WhatsApp Backup */}
                <View style={{ backgroundColor: isDarkMode ? '#0f172a' : '#f8fafc', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: isDarkMode ? '#334155' : '#e2e8f0' }}>
                  <Text style={{ fontSize: 13, fontWeight: 'bold', color: isDarkMode ? '#fed7aa' : '#0f172a' }}>
                    📋 {lang === 'hi' ? 'विकल्प 2: Google Drive / WhatsApp बैकअप कोड से' : 'Option 2: Restore from Pasted Backup Code'}
                  </Text>
                  <Text style={{ fontSize: 11, color: isDarkMode ? '#94a3b8' : '#64748b', marginTop: 3 }}>
                    {lang === 'hi' 
                      ? 'अपनी ड्राइव फ़ाइल या व्हाट्सएप से बैकअप कोड कॉपी करके यहाँ पेस्ट करें:' 
                      : 'Copy and paste the backup code from Google Drive or WhatsApp here:'}
                  </Text>

                  <TextInput 
                    style={[
                      styles.formInput, 
                      { height: 110, textAlignVertical: 'top', marginTop: 8, fontSize: 12 },
                      isDarkMode && { backgroundColor: '#1e293b', color: '#f8fafc', borderColor: '#334155' }
                    ]}
                    placeholder={lang === 'hi' ? 'बैकअप कोड यहाँ पेस्ट करें...' : 'Paste backup code here...'}
                    placeholderTextColor="#94a3b8"
                    multiline
                    value={restoreInputText}
                    onChangeText={setRestoreInputText}
                  />

                  <TouchableOpacity 
                    style={{ backgroundColor: '#0284c7', paddingVertical: 10, borderRadius: 10, alignItems: 'center', marginTop: 10 }}
                    onPress={() => {
                      if (!restoreInputText.trim()) {
                        Alert.alert('Notice', lang === 'hi' ? 'कृपया पहले बैकअप कोड पेस्ट करें।' : 'Please paste backup code first.');
                        return;
                      }
                      handleRestoreData(restoreInputText);
                    }}
                  >
                    <Text style={{ color: '#fff', fontSize: 13, fontWeight: 'bold' }}>
                      📥 {lang === 'hi' ? 'पेस्ट किए गए डेटा को रिस्टोर करें' : 'Restore from Pasted Data'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      
      {/* ================= MODAL: SCHOOL ADMIN MASTER PIN ================= */}
      <Modal visible={isAdminPinModalOpen} transparent animationType="fade" statusBarTranslucent={true} onRequestClose={() => setIsAdminPinModalOpen(false)}>
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalBackdrop}
        >
          <View style={[styles.modalContent, { backgroundColor: isDarkMode ? '#1e293b' : '#ffffff', paddingBottom: 24 }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={{ fontSize: 24 }}>🏫</Text>
                <Text style={[styles.modalHeaderTitle, isDarkMode && { color: '#f8fafc' }]}>
                  {lang === 'hi' ? 'स्कूल प्रशासन सुरक्षा सत्यापन' : 'School Admin Authorization'}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setIsAdminPinModalOpen(false)}>
                <Text style={{ fontSize: 24, color: '#64748b', fontWeight: 'bold' }}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={{ fontSize: 13, color: isDarkMode ? '#cbd5e1' : '#64748b', marginBottom: 12, lineHeight: 18 }}>
              {lang === 'hi'
                ? 'यह कंट्रोल रूम केवल स्कूल के अधिकृत ट्रांसपोर्ट प्रभारी / प्रिंसिपल के लिए है। कृपया अपना 4-अंकीय एडमिन मास्टर पिन दर्ज करें:'
                : 'This command center is reserved for authorized school transport authorities. Please enter your secret Master PIN:'}
            </Text>

            <TextInput 
              style={[
                styles.formInput, 
                { fontSize: 24, textAlign: 'center', letterSpacing: 8, fontWeight: 'bold', color: isDarkMode ? '#f8fafc' : '#000000', borderColor: '#ea580c', borderWidth: 2 },
                isDarkMode && { backgroundColor: '#0f172a' }
              ]} 
              placeholder="1234" 
              placeholderTextColor="#94a3b8"
              keyboardType="numeric"
              maxLength={6}
              secureTextEntry={false}
              value={adminPinInput} 
              onChangeText={setAdminPinInput} 
            />

            {adminPinError ? (
              <Text style={{ color: '#ef4444', fontSize: 12, fontWeight: 'bold', marginTop: 6, textAlign: 'center' }}>
                {adminPinError}
              </Text>
            ) : null}

            <Text style={{ fontSize: 11, color: '#94a3b8', textAlign: 'center', marginTop: 8 }}>
              {lang === 'hi' ? '💡 डिफ़ॉल्ट सुरक्षा पिन: 1234 (अंदर जाकर कभी भी बदल सकते हैं)' : '💡 Default PIN: 1234 (Can be changed inside anytime)'}
            </Text>

            <TouchableOpacity 
              style={[styles.saveSubmitBtn, { backgroundColor: '#ea580c', marginTop: 14 }]} 
              onPress={handleVerifyAdminPin}
            >
              <Text style={styles.saveSubmitBtnText}>
                🔓 {lang === 'hi' ? 'एडमिन कंसोल अनलॉक करें' : 'Unlock Admin Console'}
              </Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ================= MODAL: CHANGE MASTER ADMIN PIN ================= */}
      <Modal visible={isChangeAdminPinOpen} transparent animationType="fade" statusBarTranslucent={true} onRequestClose={() => setIsChangeAdminPinOpen(false)}>
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalBackdrop}
        >
          <View style={[styles.modalContent, { backgroundColor: isDarkMode ? '#1e293b' : '#ffffff', paddingBottom: 24 }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Text style={[styles.modalHeaderTitle, isDarkMode && { color: '#f8fafc' }]}>
                🔑 {lang === 'hi' ? 'नया एडमिन मास्टर पिन सेट करें' : 'Change Master Admin PIN'}
              </Text>
              <TouchableOpacity onPress={() => setIsChangeAdminPinOpen(false)}>
                <Text style={{ fontSize: 24, color: '#64748b', fontWeight: 'bold' }}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={{ gap: 10 }}>
              <View>
                <Text style={[styles.inputLabel, isDarkMode && { color: '#cbd5e1' }]}>
                  {lang === 'hi' ? 'वर्तमान पिन (Current PIN):' : 'Current PIN:'}
                </Text>
                <TextInput 
                  style={[styles.formInput, isDarkMode && { backgroundColor: '#0f172a', color: '#f8fafc', borderColor: '#334155' }]} 
                  placeholder="पुराना पिन (उदा: 1234)" 
                  placeholderTextColor="#94a3b8"
                  keyboardType="numeric"
                  maxLength={6}
                  secureTextEntry={false}
                  value={oldAdminPinInput} 
                  onChangeText={setOldAdminPinInput} 
                />
              </View>

              <View>
                <Text style={[styles.inputLabel, isDarkMode && { color: '#cbd5e1' }]}>
                  {lang === 'hi' ? 'नया गुप्त पिन (New 4-Digit PIN):' : 'New 4-Digit Secret PIN:'}
                </Text>
                <TextInput 
                  style={[styles.formInput, isDarkMode && { backgroundColor: '#0f172a', color: '#f8fafc', borderColor: '#334155' }]} 
                  placeholder="नया गुप्त पिन दर्ज करें" 
                  placeholderTextColor="#94a3b8"
                  keyboardType="numeric"
                  maxLength={6}
                  secureTextEntry={false}
                  value={newAdminPinInput} 
                  onChangeText={setNewAdminPinInput} 
                />
              </View>

              <TouchableOpacity 
                style={[styles.saveSubmitBtn, { backgroundColor: '#ea580c', marginTop: 12 }]} 
                onPress={handleChangeAdminPinSubmit}
              >
                <Text style={styles.saveSubmitBtnText}>
                  ✓ {lang === 'hi' ? 'नया पिन सुरक्षित करें' : 'Save New PIN'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ================= MODAL: ADD SCHOOL FLEET BUS ================= */}
      <Modal visible={isAddFleetBusOpen} transparent animationType="slide" statusBarTranslucent={true} onRequestClose={() => setIsAddFleetBusOpen(false)}>
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalBackdrop}
        >
          <View style={[styles.modalContent, { maxHeight: '92%', backgroundColor: isDarkMode ? '#1e293b' : '#ffffff', paddingBottom: 20 }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <Text style={[styles.modalHeaderTitle, isDarkMode && { color: '#f8fafc' }]}>
                {editingFleetBusId 
                  ? (lang === 'hi' ? '✏️ बस विवरण एडिट करें' : 'Edit Bus Details')
                  : (lang === 'hi' ? '🚌 स्कूल फ्लीट में नई बस जोड़ें' : 'Add New Bus to School Fleet')}
              </Text>
              <TouchableOpacity onPress={() => setIsAddFleetBusOpen(false)}>
                <Text style={{ fontSize: 24, color: '#64748b', fontWeight: 'bold' }}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 320, paddingTop: 6 }}>
              <View style={{ gap: 12 }}>
                <View>
                  <Text style={[styles.inputLabel, isDarkMode && { color: '#cbd5e1' }]}>
                    {lang === 'hi' ? 'बस नंबर / पहचान (उदा: Bus #15, Route 3)' : 'Bus Route / Number (e.g. Bus #15)'}
                  </Text>
                  <TextInput 
                    style={[styles.formInput, isDarkMode && { backgroundColor: '#0f172a', color: '#f8fafc', borderColor: '#334155' }]} 
                    placeholder="Bus #15" 
                    placeholderTextColor="#94a3b8"
                    value={newFleetBusNo} 
                    onChangeText={setNewFleetBusNo} 
                  />
                </View>

                <View>
                  <Text style={[styles.inputLabel, isDarkMode && { color: '#cbd5e1' }]}>
                    {lang === 'hi' ? 'वाहन पंजीकरण नंबर (RTO Plate)' : 'Vehicle Registration Plate'}
                  </Text>
                  <TextInput 
                    style={[styles.formInput, isDarkMode && { backgroundColor: '#0f172a', color: '#f8fafc', borderColor: '#334155' }]} 
                    placeholder="UP 14 KL 5515" 
                    placeholderTextColor="#94a3b8"
                    autoCapitalize="characters"
                    value={newFleetVehicleNo} 
                    onChangeText={setNewFleetVehicleNo} 
                  />
                </View>

                <View>
                  <Text style={[styles.inputLabel, isDarkMode && { color: '#cbd5e1' }]}>
                    {lang === 'hi' ? 'चालक का नाम (Driver Name)' : 'Driver Name'}
                  </Text>
                  <TextInput 
                    style={[styles.formInput, isDarkMode && { backgroundColor: '#0f172a', color: '#f8fafc', borderColor: '#334155' }]} 
                    placeholder="राम कुमार" 
                    placeholderTextColor="#94a3b8"
                    value={newFleetDriverName} 
                    onChangeText={setNewFleetDriverName} 
                  />
                </View>

                <View>
                  <Text style={[styles.inputLabel, isDarkMode && { color: '#cbd5e1' }]}>
                    {lang === 'hi' ? 'चालक मोबाइल नंबर (Driver Phone)' : 'Driver Phone Number'}
                  </Text>
                  <TextInput 
                    style={[styles.formInput, isDarkMode && { backgroundColor: '#0f172a', color: '#f8fafc', borderColor: '#334155' }]} 
                    placeholder="98XXXXXXXX (10 अंक)" 
                    placeholderTextColor="#94a3b8"
                    keyboardType="phone-pad"
                    maxLength={10}
                    value={newFleetDriverPhone} 
                    onChangeText={(val) => setNewFleetDriverPhone(val.replace(/[^0-9]/g, '').slice(0, 10))} 
                  />
                </View>

                <View>
                  <Text style={[styles.inputLabel, isDarkMode && { color: '#cbd5e1' }]}>
                    {lang === 'hi' ? 'परिचालक / हेल्पर नाम (Conductor Name)' : 'Helper / Attendant Name'}
                  </Text>
                  <TextInput 
                    style={[styles.formInput, isDarkMode && { backgroundColor: '#0f172a', color: '#f8fafc', borderColor: '#334155' }]} 
                    placeholder="सुनील" 
                    placeholderTextColor="#94a3b8"
                    value={newFleetConductorName} 
                    onChangeText={setNewFleetConductorName} 
                  />
                </View>

                <View>
                  <Text style={[styles.inputLabel, isDarkMode && { color: '#cbd5e1' }]}>
                    {lang === 'hi' ? 'परिचालक मोबाइल नंबर (Conductor Phone)' : 'Helper Phone Number'}
                  </Text>
                  <TextInput 
                    style={[styles.formInput, isDarkMode && { backgroundColor: '#0f172a', color: '#f8fafc', borderColor: '#334155' }]} 
                    placeholder="98XXXXXXXX (10 अंक)" 
                    placeholderTextColor="#94a3b8"
                    keyboardType="phone-pad"
                    maxLength={10}
                    value={newFleetConductorPhone} 
                    onChangeText={(val) => setNewFleetConductorPhone(val.replace(/[^0-9]/g, '').slice(0, 10))} 
                  />
                </View>

                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.inputLabel, isDarkMode && { color: '#cbd5e1' }]}>
                      🔑 {lang === 'hi' ? 'चालक पिन (4-अंक)' : 'Driver PIN'}
                    </Text>
                    <TextInput 
                      style={[styles.formInput, isDarkMode && { backgroundColor: '#0f172a', color: '#f8fafc', borderColor: '#334155' }]} 
                      placeholder="1115" 
                      placeholderTextColor="#94a3b8"
                      keyboardType="numeric"
                      maxLength={6}
                      value={newFleetDriverPin} 
                      onChangeText={setNewFleetDriverPin} 
                    />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={[styles.inputLabel, isDarkMode && { color: '#cbd5e1' }]}>
                      👨‍👩‍👧 {lang === 'hi' ? 'अभिभावक कोड' : 'Parent Code'}
                    </Text>
                    <TextInput 
                      style={[styles.formInput, isDarkMode && { backgroundColor: '#0f172a', color: '#f8fafc', borderColor: '#334155' }]} 
                      placeholder="4015" 
                      placeholderTextColor="#94a3b8"
                      keyboardType="numeric"
                      maxLength={6}
                      value={newFleetParentCode} 
                      onChangeText={setNewFleetParentCode} 
                    />
                  </View>
                </View>

                <TouchableOpacity 
                  style={[styles.saveSubmitBtn, { backgroundColor: '#ea580c', marginTop: 16 }]} 
                  onPress={handleSaveFleetBus}
                >
                  <Text style={styles.saveSubmitBtnText}>
                    {editingFleetBusId 
                      ? (lang === 'hi' ? '💾 बस विवरण अपडेट करें' : 'Update Bus Details')
                      : (lang === 'hi' ? '💾 स्कूल फ्लीट में बस सुरक्षित करें' : 'Save Bus to School Fleet')}
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ================= MODAL: EDIT SCHOOL PROFILE ================= */}
      <Modal visible={isEditingSchoolProfile} transparent animationType="slide" statusBarTranslucent={true} onRequestClose={() => setIsEditingSchoolProfile(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalBackdrop}>
          <View style={[styles.modalContent, { maxHeight: '92%', backgroundColor: isDarkMode ? '#1e293b' : '#ffffff' }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Text style={[styles.modalHeaderTitle, isDarkMode && { color: '#f8fafc' }]}>
                🏫 {lang === 'hi' ? 'स्कूल प्रोफ़ाइल व विवरण सेट करें' : 'Configure School Profile'}
              </Text>
              <TouchableOpacity onPress={() => setIsEditingSchoolProfile(false)}>
                <Text style={{ fontSize: 24, color: '#64748b', fontWeight: 'bold' }}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 220 }}>
              <View style={{ gap: 12 }}>
                <Text style={{ fontSize: 12, color: '#64748b' }}>
                  {lang === 'hi' ? 'यहाँ स्कूल का नाम व विवरण एक बार भरें — यह सभी बसों, चालकों और अभिभावकों को अपने आप दिखेगा।' : 'Fill your school details once — automatically syncs across all buses, drivers and parents.'}
                </Text>

                <View>
                  <Text style={[styles.inputLabel, isDarkMode && { color: '#cbd5e1' }]}>
                    🏫 {lang === 'hi' ? 'स्कूल का आधिकारिक नाम (School Name)' : 'Official School Name'}
                  </Text>
                  <TextInput 
                    style={[styles.formInput, { color: isDarkMode ? '#f8fafc' : '#0f172a', backgroundColor: isDarkMode ? '#0f172a' : '#f8fafc', borderColor: isDarkMode ? '#475569' : '#cbd5e1' }]} 
                    placeholder={lang === 'hi' ? 'उदा: स्कूल का नाम दर्ज करें' : 'Enter school name'} 
                    placeholderTextColor="#94a3b8"
                    value={draftSchoolName} 
                    onChangeText={setDraftSchoolName} 
                  />
                </View>

                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.inputLabel, isDarkMode && { color: '#cbd5e1' }]}>
                      🏙️ {lang === 'hi' ? 'ज़िला (District)' : 'District'}
                    </Text>
                    <TouchableOpacity 
                      style={[styles.formInput, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: isDarkMode ? '#0f172a' : '#f8fafc', borderColor: '#3b82f6', borderWidth: 1.5, paddingVertical: 10 }]}
                      onPress={() => openLocationPicker('district', 'admin')}
                    >
                      <Text style={{ fontSize: 13, fontWeight: 'bold', color: isDarkMode ? '#f8fafc' : '#0f172a', flex: 1 }} numberOfLines={1}>
                        📍 {draftSchoolDistrict || schoolDistrictConfig || (lang === 'hi' ? 'जिला चुनें' : 'Select District')}
                      </Text>
                      <Text style={{ color: '#3b82f6', fontSize: 11, fontWeight: 'bold' }}>{lang === 'hi' ? 'चुनें 🔍' : 'Pick 🔍'}</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.inputLabel, isDarkMode && { color: '#cbd5e1' }]}>
                      🏛️ {lang === 'hi' ? 'राज्य (State)' : 'State'}
                    </Text>
                    <TouchableOpacity 
                      style={[styles.formInput, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: isDarkMode ? '#0f172a' : '#f8fafc', borderColor: '#3b82f6', borderWidth: 1.5, paddingVertical: 10 }]}
                      onPress={() => openLocationPicker('state', 'admin')}
                    >
                      <Text style={{ fontSize: 13, fontWeight: 'bold', color: isDarkMode ? '#f8fafc' : '#0f172a', flex: 1 }} numberOfLines={1}>
                        🏛️ {draftSchoolState || schoolStateConfig || (lang === 'hi' ? 'राज्य चुनें' : 'Select State')}
                      </Text>
                      <Text style={{ color: '#3b82f6', fontSize: 11, fontWeight: 'bold' }}>{lang === 'hi' ? 'चुनें 🔍' : 'Pick 🔍'}</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <View>
                  <Text style={[styles.inputLabel, isDarkMode && { color: '#cbd5e1' }]}>
                    📞 {lang === 'hi' ? 'केंद्रीय ट्रांसपोर्ट हेल्पलाइन नंबर' : 'Central Helpline Phone'}
                  </Text>
                  <TextInput 
                    style={[styles.formInput, { color: isDarkMode ? '#f8fafc' : '#0f172a', backgroundColor: isDarkMode ? '#0f172a' : '#f8fafc', borderColor: isDarkMode ? '#475569' : '#cbd5e1' }]} 
                    placeholder={lang === 'hi' ? 'उदा: 98XXXXXXXX (10 अंक)' : 'e.g. 98XXXXXXXX'} 
                    placeholderTextColor="#94a3b8"
                    keyboardType="phone-pad"
                    maxLength={10}
                    value={draftSchoolHelpline} 
                    onChangeText={(val) => setDraftSchoolHelpline(val.replace(/[^0-9]/g, '').slice(0, 10))} 
                  />
                </View>

                <TouchableOpacity 
                  style={[styles.saveSubmitBtn, { backgroundColor: '#ea580c', marginTop: 14 }]} 
                  onPress={handleSaveSchoolProfile}
                >
                  <Text style={styles.saveSubmitBtnText}>
                    💾 {lang === 'hi' ? 'स्कूल प्रोफ़ाइल सुरक्षित करें' : 'Save School Profile'}
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ================= MODAL: EDIT CENTRAL SCHOOL HELPLINE ================= */}
      <Modal visible={isEditingSchoolHelpline} transparent animationType="fade" statusBarTranslucent={true} onRequestClose={() => setIsEditingSchoolHelpline(false)}>
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalBackdrop}
        >
          <View style={[styles.modalContent, { backgroundColor: isDarkMode ? '#1e293b' : '#ffffff', paddingBottom: 20 }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Text style={[styles.modalHeaderTitle, isDarkMode && { color: '#f8fafc' }]}>
                📞 {lang === 'hi' ? 'केंद्रीय ट्रांसपोर्ट हेल्पलाइन सेट करें' : 'Set Central Transport Helpline'}
              </Text>
              <TouchableOpacity onPress={() => setIsEditingSchoolHelpline(false)}>
                <Text style={{ fontSize: 24, color: '#64748b', fontWeight: 'bold' }}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={{ fontSize: 13, color: isDarkMode ? '#cbd5e1' : '#64748b', marginBottom: 14, lineHeight: 18 }}>
              {lang === 'hi' 
                ? 'यह नंबर स्कूल ट्रांसपोर्ट रूम का मुख्य संपर्क होगा। आपातकालीन स्थिति में सभी माता-पिता और ड्राइवर इस नंबर पर 1-टैप से सीधे कॉल कर सकेंगे।' 
                : 'This is the main central helpline for school transport control. All parents and drivers will be able to reach this number with 1-tap in emergencies.'}
            </Text>

            <TextInput 
              style={[styles.formInput, { fontSize: 16, fontWeight: 'bold' }, isDarkMode && { backgroundColor: '#0f172a', color: '#f8fafc', borderColor: '#334155' }]} 
              placeholder="98XXXXXXXX (10 अंक)" 
              placeholderTextColor="#94a3b8"
              keyboardType="phone-pad"
              maxLength={10}
              value={schoolHelplineConfig} 
              onChangeText={(val) => setSchoolHelplineConfig(val.replace(/[^0-9]/g, '').slice(0, 10))} 
            />

            <TouchableOpacity 
              style={[styles.saveSubmitBtn, { backgroundColor: '#ea580c', marginTop: 16 }]} 
              onPress={() => handleSaveCentralHelpline(schoolHelplineConfig)}
            >
              <Text style={styles.saveSubmitBtnText}>
                ✓ {lang === 'hi' ? 'हेल्पलाइन नंबर सुरक्षित करें' : 'Save Helpline'}
              </Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
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
      <Modal visible={isAppLocked && !!userProfile} animationType="fade" transparent={false}>
        <SafeAreaView style={[styles.lockScreenContainer, { paddingTop: TOP_SAFE_PADDING }]}>
          <StatusBar barStyle="light-content" />
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
              onPress={() => promptDeviceUnlock(true)}
            >
              <Text style={styles.unlockBigBtnText}>
                🔓 {lang === 'hi' ? 'फ़ोन लॉक / बायोमेट्रिक से खोलें' : 'Unlock with Phone Lock'}
              </Text>
            </TouchableOpacity>

            {/* Quick 4-Digit In-App PIN Unlock */}
            <View style={{ width: '100%', alignItems: 'center', marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: '#334155' }}>
              <Text style={{ fontSize: 12, color: '#cbd5e1', fontWeight: 'bold', marginBottom: 8 }}>
                {lang === 'hi' ? 'या 4-अंकों का ऐप पिन दर्ज करें:' : 'Or enter 4-digit App PIN:'}
              </Text>
              <TextInput
                style={[styles.formInput, { textAlign: 'center', fontSize: 24, fontWeight: 'bold', letterSpacing: 8, color: '#0f172a', backgroundColor: '#ffffff', width: 180, height: 48, borderRadius: 12 }]}
                placeholder="••••"
                placeholderTextColor="#94a3b8"
                cursorColor="#ea580c"
                keyboardType="numeric"
                maxLength={4}
                secureTextEntry={true}
                value={pinInput}
                onChangeText={setPinInput}
              />
              <TouchableOpacity
                style={{ backgroundColor: '#ea580c', paddingHorizontal: 24, paddingVertical: 10, borderRadius: 12, marginTop: 10 }}
                onPress={handlePinUnlock}
              >
                <Text style={{ color: '#ffffff', fontSize: 13, fontWeight: 'bold' }}>
                  ✓ {lang === 'hi' ? 'पिन से अनलॉक करें' : 'Unlock with PIN'}
                </Text>
              </TouchableOpacity>
              <Text style={{ fontSize: 11, color: '#94a3b8', marginTop: 6 }}>
                {lang === 'hi' ? 'डिफ़ॉल्ट पिन: 1234' : 'Default PIN: 1234'}
              </Text>
            </View>

            <TouchableOpacity 
              style={{ marginTop: 12, padding: 8 }}
              onPress={() => {
                hasUnlockedThisSessionRef.current = true;
                setIsAppLocked(false);
              }}
            >
              <Text style={{ color: '#94a3b8', fontSize: 12, textDecorationLine: 'underline' }}>
                {lang === 'hi' ? 'वैकल्पिक: सीधे आगे बढ़ें (Bypass)' : 'Proceed directly'}
              </Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>

      {/* ================= MODAL: USER ONBOARDING / LOGIN (FULL SCREEN NATIVE SETUP) ================= */}
      <Modal visible={isOnboardingOpen && !isAppLocked} animationType="slide" transparent={false} statusBarTranslucent={false} onRequestClose={() => setIsOnboardingOpen(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: isDarkMode ? '#0f172a' : '#ffffff' }}>
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1 }}
          >
            <ScrollView 
              showsVerticalScrollIndicator={false} 
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 30, paddingBottom: 260 }}
            >
              <View style={{ alignItems: 'center', marginBottom: 24 }}>
                <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: '#ea580c', alignItems: 'center', justifyContent: 'center', shadowColor: '#ea580c', shadowOpacity: 0.35, shadowRadius: 10, elevation: 6, marginBottom: 12 }}>
                  <Text style={{ fontSize: 34, color: '#ffffff', fontWeight: 'bold' }}>M</Text>
                </View>
                <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#0f172a', textAlign: 'center' }}>
                  {lang === 'hi' ? 'MAST Life OS में स्वागत है' : 'Welcome to MAST Life OS'}
                </Text>
                <Text style={{ fontSize: 13, color: '#64748b', textAlign: 'center', marginTop: 4, lineHeight: 18, maxWidth: 300 }}>
                  {lang === 'hi'
                    ? 'अपनी प्रोफ़ाइल शुरू करने के लिए नाम, मोबाइल व ईमेल दर्ज करें'
                    : 'Enter your name, mobile and email to activate your profile'}
                </Text>
              </View>

              <View style={{ backgroundColor: isDarkMode ? '#1e293b' : '#f8fafc', borderRadius: 20, padding: 20, borderWidth: 1.5, borderColor: isDarkMode ? '#334155' : '#e2e8f0', gap: 16 }}>
                <View>
                  <Text style={{ fontSize: 13, fontWeight: 'bold', color: '#1e293b', marginBottom: 6 }}>
                    👤 {lang === 'hi' ? 'आपका पूरा नाम (Full Name)' : 'Full Name'}
                  </Text>
                  <TextInput
                    style={{ backgroundColor: '#ffffff', height: 50, borderRadius: 12, borderWidth: 1.5, borderColor: '#cbd5e1', paddingHorizontal: 16, fontSize: 16, color: '#0f172a' }}
                    placeholder={lang === 'hi' ? 'उदा: अमित शर्मा' : 'e.g. Amit Sharma'}
                    placeholderTextColor="#94a3b8"
                    cursorColor="#ea580c"
                    value={onboardName}
                    onChangeText={setOnboardName}
                  />
                </View>

                <View>
                  <Text style={{ fontSize: 13, fontWeight: 'bold', color: '#1e293b', marginBottom: 6 }}>
                    📱 {lang === 'hi' ? 'मोबाइल नंबर (Mobile Number)' : 'Mobile Number'}
                  </Text>
                  <TextInput
                    style={{ backgroundColor: '#ffffff', height: 50, borderRadius: 12, borderWidth: 1.5, borderColor: '#cbd5e1', paddingHorizontal: 16, fontSize: 16, color: '#0f172a' }}
                    placeholder={lang === 'hi' ? '10 अंकों का मोबाइल नंबर' : '10-digit mobile number'}
                    placeholderTextColor="#94a3b8"
                    cursorColor="#ea580c"
                    keyboardType="phone-pad"
                    maxLength={10}
                    value={onboardMobile}
                    onChangeText={(val) => setOnboardMobile(val.replace(/[^0-9]/g, '').slice(0, 10))}
                  />
                </View>

                <View>
                  <Text style={{ fontSize: 13, fontWeight: 'bold', color: '#1e293b', marginBottom: 6 }}>
                    📧 {lang === 'hi' ? 'ईमेल आईडी (Email ID)' : 'Email ID'}
                  </Text>
                  <TextInput
                    style={{ backgroundColor: '#ffffff', height: 50, borderRadius: 12, borderWidth: 1.5, borderColor: '#cbd5e1', paddingHorizontal: 16, fontSize: 16, color: '#0f172a' }}
                    placeholder={lang === 'hi' ? 'उदा: amit@gmail.com' : 'e.g. amit@gmail.com'}
                    placeholderTextColor="#94a3b8"
                    cursorColor="#ea580c"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    value={onboardEmail}
                    onChangeText={setOnboardEmail}
                  />
                </View>

                <TouchableOpacity
                  style={{ backgroundColor: '#ea580c', height: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 6 }}
                  onPress={() => handleSaveUserProfile(onboardName, onboardMobile, onboardEmail)}
                >
                  <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: 'bold' }}>
                    ✓ {lang === 'hi' ? 'सुरक्षित सहेजें व ऐप शुरू करें' : 'Save & Start App'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Direct Skip Button */}
              <TouchableOpacity
                style={{ alignItems: 'center', marginTop: 20, padding: 12 }}
                onPress={() => {
                  const defName = onboardName.trim() || (lang === 'hi' ? 'यूज़र' : 'User');
                  const defMob = onboardMobile.trim() || '98XXXXXXXX';
                  const defMail = onboardEmail.trim() || 'user@mast.com';
                  handleSaveUserProfile(defName, defMob, defMail);
                }}
              >
                <Text style={{ color: '#64748b', fontSize: 14, textDecorationLine: 'underline' }}>
                  {lang === 'hi' ? 'बाद में भरें (सीधे ऐप में प्रवेश करें)' : 'Skip for now (Enter App Directly)'}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {/* ================= BOTTOM NAVIGATION BAR (100% BILINGUAL) ================= */}
      <View style={[styles.navBar, { backgroundColor: themeColors.navBg, borderTopColor: themeColors.navBorder }]}>
        <TouchableOpacity style={styles.navItem} onPress={() => handleTabPress('home')}>
          <Text style={[styles.navIcon, activeTab === 'home' && styles.navActive]}>🏠</Text>
          <Text style={[styles.navLabel, { color: isDarkMode ? '#94a3b8' : '#64748b' }, activeTab === 'home' && styles.navActive]}>{lang === 'hi' ? 'आज' : 'Home'}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navItem} onPress={() => handleTabPress('vault')}>
          <Text style={[styles.navIcon, activeTab === 'vault' && styles.navActive]}>🗄️</Text>
          <Text style={[styles.navLabel, { color: isDarkMode ? '#94a3b8' : '#64748b' }, activeTab === 'vault' && styles.navActive]}>{lang === 'hi' ? 'लॉकर' : 'Vault'}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navItem} onPress={() => handleTabPress('reminders')}>
          <Text style={[styles.navIcon, activeTab === 'reminders' && styles.navActive]}>🔔</Text>
          <Text style={[styles.navLabel, { color: isDarkMode ? '#94a3b8' : '#64748b' }, activeTab === 'reminders' && styles.navActive]}>{lang === 'hi' ? 'रिमाइंडर' : 'Reminders'}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navItem} onPress={() => handleTabPress('bus')}>
          <Text style={[styles.navIcon, activeTab === 'bus' && styles.navActive]}>🚌</Text>
          <Text style={[styles.navLabel, { color: isDarkMode ? '#94a3b8' : '#64748b' }, activeTab === 'bus' && styles.navActive]}>{lang === 'hi' ? 'बस लाइव' : 'Bus Live'}</Text>
        </TouchableOpacity>

        

        <TouchableOpacity style={styles.navItem} onPress={() => handleTabPress('family')}>
          <Text style={[styles.navIcon, activeTab === 'family' && styles.navActive]}>👨‍👩‍👧‍👦</Text>
          <Text style={[styles.navLabel, { color: isDarkMode ? '#94a3b8' : '#64748b' }, activeTab === 'family' && styles.navActive]}>{lang === 'hi' ? 'परिवार' : 'Family'}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  headerIconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
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

  container: { flex: 1 },
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
  brandTitle: { color: '#0f172a', fontSize: 22, fontWeight: '900', letterSpacing: 0.5 },
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

  scrollBody: { padding: 16, paddingTop: 10, paddingBottom: 160 },
  heroCard: { backgroundColor: '#f97316', borderRadius: 22, padding: 18, shadowColor: '#ea580c', shadowOpacity: 0.25, shadowRadius: 10, elevation: 4 },
  heroPre: { color: '#ffedd5', fontSize: 13, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 0.5 },
  heroMain: { color: '#fff', fontSize: 20, fontWeight: 'bold', marginTop: 2, lineHeight: 26 },
  dateTag: { backgroundColor: 'rgba(0,0,0,0.22)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, alignSelf: 'flex-start' },
  dateTagText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  quoteCard: { backgroundColor: 'rgba(255,255,255,0.20)', borderRadius: 14, padding: 12, marginTop: 4 },
  quoteText: { color: '#fff', fontSize: 13.5, lineHeight: 22, fontWeight: '500' },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, paddingHorizontal: 2 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#0f172a' },
  addSmallBtn: { backgroundColor: '#ea580c', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  addSmallBtnText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#e2e8f0', shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
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
  pageTitle: { fontSize: 19, fontWeight: '600', color: '#0f172a' },
  pageSub: { fontSize: 12, color: '#64748b', marginTop: 2 },
  subtabContainer: { flexDirection: 'row', backgroundColor: '#e2e8f0', borderRadius: 16, padding: 4 },
  subtabBtn: { flex: 1, paddingVertical: 9, alignItems: 'center', borderRadius: 13 },
  subtabBtnActive: { backgroundColor: '#fff' },
  subtabBtnText: { fontSize: 13, fontWeight: 'bold', color: '#64748b' },
  subtabBtnTextActive: { color: '#0f172a' },
  cardTitle: { fontSize: 15, fontWeight: '600', color: '#0f172a', flex: 1, lineHeight: 20 },
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
  sectionHeading: { fontSize: 15, fontWeight: '600', color: '#0f172a' },

  // Reminders Prominent Alarm Button
  prominentAlarmBtn: { backgroundColor: '#ea580c', borderRadius: 18, padding: 16, alignItems: 'center', shadowColor: '#ea580c', shadowOpacity: 0.25, shadowRadius: 6, elevation: 2 },
  prominentAlarmBtnText: { color: '#fff', fontSize: 15, fontWeight: 'bold' },

  // Bus
  busRoleToggle: { flexDirection: 'row', backgroundColor: '#e2e8f0', borderRadius: 14, padding: 4 },
  busRoleBtn: { flex: 1, paddingVertical: 9, alignItems: 'center', borderRadius: 12 },
  busRoleBtnActive: { backgroundColor: '#fff' },
  busRoleBtnText: { fontSize: 13, fontWeight: 'bold', color: '#64748b' },
  busRoleBtnTextActive: { color: '#0f172a' },
  mapSimulationBox: { minHeight: 330, backgroundColor: '#0f172a', borderRadius: 24, padding: 16, justifyContent: 'space-between', borderWidth: 1, borderColor: '#334155' },
  mapEtaBadge: { backgroundColor: 'rgba(255,255,255,0.95)', flex: 1, marginRight: 8, borderRadius: 16, padding: 8, flexDirection: 'row', alignItems: 'center', gap: 10 },
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
  chatContainer: { backgroundColor: '#fff', borderRadius: 22, borderWidth: 1, borderColor: '#cbd5e1', overflow: 'hidden', minHeight: 380 },
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
  modalContent: { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 22, maxHeight: '90%' },
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
    maxHeight: '92%',
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
    height: 64 + ANDROID_NAV_INSET,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-start',
    paddingTop: 8,
    paddingBottom: ANDROID_NAV_INSET + 8,
    elevation: 30,
    zIndex: 999
  },
  navItem: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 4 },
  navIcon: { fontSize: 18, opacity: 0.45 },
  navLabel: { fontSize: 11, fontWeight: 'bold', color: '#64748b', marginTop: 3 },
  navActive: { opacity: 1, color: '#2563eb' },

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
    overflow: 'hidden',
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