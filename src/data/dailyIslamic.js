import { PASSAGES } from './quranPassages';

// Rotates by day-of-year so each day shows a different entry
function pickByDay(arr) {
  const start = new Date(new Date().getFullYear(), 0, 0);
  const diff = new Date() - start;
  const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24));
  return arr[dayOfYear % arr.length];
}

export const DUAS = [
  {
    title: 'Righteous spouse and children',
    arabic: 'رَبَّنَا هَبْ لَنَا مِنْ أَزْوَاجِنَا وَذُرِّيَّاتِنَا قُرَّةَ أَعْيُنٍ وَاجْعَلْنَا لِلْمُتَّقِينَ إِمَامًا',
    transliteration: "Rabbanaa hab lanaa min azwaajinaa wa dhurriyyaatinaa qurrata a'yunin waj'alnaa lil-muttaqeena imaamaa.",
    translation: 'Our Lord, grant us from our spouses and children comfort to our eyes and make us leaders for the righteous.',
    reference: 'Qur\'an 25:74',
  },
  {
    title: 'Establish prayer for oneself and offspring',
    arabic: 'رَبِّ اجْعَلْنِي مُقِيمَ الصَّلَاةِ وَمِنْ ذُرِّيَّتِي ۚ رَبَّنَا وَتَقَبَّلْ دُعَاءِ',
    transliteration: "Rabbi-j'alnee muqeema-s-salaati wa min dhurriyyatee, rabbanaa wa taqabbal du'aa'.",
    translation: 'My Lord, make me an establisher of prayer, and from my offspring as well. Our Lord, accept my supplication.',
    reference: 'Qur\'an 14:40',
  },
  {
    title: 'Gratitude, righteous deeds, and righteous offspring',
    arabic: 'رَبِّ أَوْزِعْنِي أَنْ أَشْكُرَ نِعْمَتَكَ الَّتِي أَنْعَمْتَ عَلَيَّ وَعَلَىٰ وَالِدَيَّ وَأَنْ أَعْمَلَ صَالِحًا تَرْضَاهُ وَأَصْلِحْ لِي فِي ذُرِّيَّتِي ۖ إِنِّي تُبْتُ إِلَيْكَ وَإِنِّي مِنَ الْمُسْلِمِينَ',
    transliteration: "Rabbi awzi'nee an ashkura ni'mataka allatee an'amta 'alayya wa 'alaa waalidayya wa an a'mala saalihan tardaahu wa aslih lee fee dhurriyyatee, innee tubtu ilayka wa innee mina-l-muslimeen.",
    translation: 'My Lord, enable me to be grateful for Your favor which You bestowed upon me and upon my parents, and to do righteousness that pleases You, and make righteous for me my offspring. Indeed, I have repented to You, and indeed I am of the Muslims.',
    reference: 'Qur\'an 46:15',
  },
  {
    title: 'Righteous children',
    arabic: 'رَبِّ هَبْ لِي مِنَ الصَّالِحِينَ',
    transliteration: 'Rabbi hab lee mina-s-saaliheen.',
    translation: 'My Lord, grant me from among the righteous.',
    reference: 'Qur\'an 37:100',
  },
  {
    title: 'Pure, blessed offspring',
    arabic: 'رَبِّ هَبْ لِي مِنْ لَدُنْكَ ذُرِّيَّةً طَيِّبَةً ۖ إِنَّكَ سَمِيعُ الدُّعَاءِ',
    transliteration: "Rabbi hab lee min ladunka dhurriyyatan tayyibah, innaka samee'u-d-du'aa'.",
    translation: 'My Lord, grant me from Yourself pure offspring. Indeed, You are the Hearer of supplication.',
    reference: 'Qur\'an 3:38',
  },
  {
    title: 'Mercy upon one\'s parents',
    arabic: 'رَبِّ ارْحَمْهُمَا كَمَا رَبَّيَانِي صَغِيرًا',
    transliteration: 'Rabbi-rhamhumaa kamaa rabbayaanee sagheeraa.',
    translation: 'My Lord, have mercy upon them as they raised me when I was small.',
    reference: 'Qur\'an 17:24',
  },
  {
    title: 'Forgiveness for oneself, parents, and believers',
    arabic: 'رَبَّنَا اغْفِرْ لِي وَلِوَالِدَيَّ وَلِلْمُؤْمِنِينَ يَوْمَ يَقُومُ الْحِسَابُ',
    transliteration: 'Rabbanaa-ghfir lee wa li-waalidayya wa lil-mu\'mineena yawma yaqoomu-l-hisaab.',
    translation: 'Our Lord, forgive me, my parents, and the believers on the Day the account is established.',
    reference: 'Qur\'an 14:41',
  },
  {
    title: 'Steadfast hearts for the family',
    arabic: 'رَبَّنَا لَا تُزِغْ قُلُوبَنَا بَعْدَ إِذْ هَدَيْتَنَا وَهَبْ لَنَا مِنْ لَدُنْكَ رَحْمَةً ۚ إِنَّكَ أَنْتَ الْوَهَّابُ',
    transliteration: 'Rabbanaa laa tuzigh quloobanaa ba\'da idh hadaytanaa wa hab lanaa min ladunka rahmah, innaka anta-l-Wahhaab.',
    translation: 'Our Lord, do not let our hearts deviate after You have guided us, and grant us mercy from Yourself. Indeed, You are the Bestower.',
    reference: 'Qur\'an 3:8',
  },
  {
    title: 'Good in this life and the next',
    arabic: 'رَبَّنَا آتِنَا فِي الدُّنْيَا حَسَنَةً وَفِي الْآخِرَةِ حَسَنَةً وَقِنَا عَذَابَ النَّارِ',
    transliteration: "Rabbanaa aatinaa fi-d-dunyaa hasanatan wa fi-l-aakhirati hasanatan wa qinaa 'adhaaba-n-naar.",
    translation: 'Our Lord, give us good in this world and good in the Hereafter and protect us from the punishment of the Fire.',
    reference: 'Qur\'an 2:201',
  },
  {
    title: 'Patience and firmness',
    arabic: 'رَبَّنَا أَفْرِغْ عَلَيْنَا صَبْرًا وَثَبِّتْ أَقْدَامَنَا',
    transliteration: "Rabbanaa afrigh 'alaynaa sabran wa thabbit aqdaamanaa.",
    translation: 'Our Lord, pour upon us patience and make our feet firm.',
    reference: 'Qur\'an 2:250',
  },
  {
    title: 'Right guidance in family affairs',
    arabic: 'رَبَّنَا آتِنَا مِنْ لَدُنْكَ رَحْمَةً وَهَيِّئْ لَنَا مِنْ أَمْرِنَا رَشَدًا',
    transliteration: 'Rabbanaa aatinaa min ladunka rahmatan wa hayyi\' lanaa min amrinaa rashadaa.',
    translation: 'Our Lord, grant us mercy from Yourself and prepare for us right guidance in our affairs.',
    reference: 'Qur\'an 18:10',
  },
  {
    title: 'Protection from anxiety, incapacity, and hardship',
    arabic: 'اللَّهُمَّ إِنِّي أَعُوذُ بِكَ مِنَ الْهَمِّ وَالْحَزَنِ، وَأَعُوذُ بِكَ مِنَ الْعَجْزِ وَالْكَسَلِ، وَأَعُوذُ بِكَ مِنَ الْبُخْلِ وَالْجُبْنِ، وَأَعُوذُ بِكَ مِنْ ضَلَعِ الدَّيْنِ وَغَلَبَةِ الرِّجَالِ',
    transliteration: "Allahumma innee a'oodhu bika mina-l-hammi wa-l-hazan, wa a'oodhu bika mina-l-'ajzi wa-l-kasal, wa a'oodhu bika mina-l-bukhli wa-l-jubn, wa a'oodhu bika min dala'i-d-dayni wa ghalabati-r-rijaal.",
    translation: 'O Allah, I seek refuge in You from anxiety and grief, from incapacity and laziness, from miserliness and cowardice, and from the burden of debt and being overpowered by people.',
    reference: 'Bukhari',
  },
  {
    title: 'Protection of children from every evil',
    arabic: 'أُعِيذُكُمَا بِكَلِمَاتِ اللَّهِ التَّامَّةِ مِنْ كُلِّ شَيْطَانٍ وَهَامَّةٍ وَمِنْ كُلِّ عَيْنٍ لَامَّةٍ',
    transliteration: "U'eedhukumaa bi kalimaati-llahi-t-taammati min kulli shaytaanin wa haammah wa min kulli 'aynin laammah.",
    translation: 'I seek protection for you both in the perfect words of Allah from every devil, every harmful creature, and every evil eye.',
    reference: 'Bukhari — the Prophet ﷺ used this for Al-Hasan and Al-Husayn',
  },
  {
    title: 'Ease in parenting and hardship',
    arabic: 'اللَّهُمَّ لَا سَهْلَ إِلَّا مَا جَعَلْتَهُ سَهْلًا، وَأَنْتَ تَجْعَلُ الْحَزْنَ إِذَا شِئْتَ سَهْلًا',
    transliteration: 'Allahumma laa sahla illaa maa ja\'altahu sahlan, wa anta taj\'alu-l-hazna idhaa shi\'ta sahlan.',
    translation: 'O Allah, there is no ease except what You make easy, and You make difficulty easy if You will.',
    reference: 'Ibn Hibban',
  },
  {
    title: 'Protection from unbeneficial knowledge and an unmoved heart',
    arabic: 'اللَّهُمَّ إِنِّي أَعُوذُ بِكَ مِنْ عِلْمٍ لَا يَنْفَعُ، وَمِنْ قَلْبٍ لَا يَخْشَعُ، وَمِنْ نَفْسٍ لَا تَشْبَعُ، وَمِنْ دُعَاءٍ لَا يُسْمَعُ',
    transliteration: "Allahumma innee a'oodhu bika min 'ilmin laa yanfa', wa min qalbin laa yakhsha', wa min nafsin laa tashba', wa min du'aa'in laa yusma'.",
    translation: 'O Allah, I seek refuge in You from knowledge that does not benefit, from a heart that does not humble itself, from a soul that is never satisfied, and from a supplication that is not answered.',
    reference: 'Tirmidhi',
  },
  {
    title: 'Good character',
    arabic: 'اللَّهُمَّ اهْدِنِي لِأَحْسَنِ الْأَخْلَاقِ لَا يَهْدِي لِأَحْسَنِهَا إِلَّا أَنْتَ، وَاصْرِفْ عَنِّي سَيِّئَهَا لَا يَصْرِفُ عَنِّي سَيِّئَهَا إِلَّا أَنْتَ',
    transliteration: 'Allahumma ihdinee li-ahsani-l-akhlaaq, laa yahdee li-ahsanihaa illaa anta, wasrif \'annee sayyi\'ahaa laa yasrifu \'annee sayyi\'ahaa illaa anta.',
    translation: 'O Allah, guide me to the best character, for none guides to the best of it except You, and turn away from me bad character, for none turns away bad character from me except You.',
    reference: 'Muslim',
  },
  {
    title: 'Rectification of religion, worldly life, and afterlife',
    arabic: 'اللَّهُمَّ أَصْلِحْ لِي دِينِي الَّذِي هُوَ عِصْمَةُ أَمْرِي، وَأَصْلِحْ لِي دُنْيَايَ الَّتِي فِيهَا مَعَاشِي، وَأَصْلِحْ لِي آخِرَتِي الَّتِي فِيهَا مَعَادِي، وَاجْعَلِ الْحَيَاةَ زِيَادَةً لِي فِي كُلِّ خَيْرٍ، وَاجْعَلِ الْمَوْتَ رَاحَةً لِي مِنْ كُلِّ شَرٍّ',
    transliteration: 'Allahumma aslih lee deenee alladhee huwa \'ismatu amree, wa aslih lee dunyaaya allatee feehaa ma\'aashee, wa aslih lee aakhiratee allatee feehaa ma\'aadee, waj\'ali-l-hayaata ziyaadatan lee fee kulli khayr, waj\'ali-l-mawta raahatan lee min kulli sharr.',
    translation: 'O Allah, rectify for me my religion which is the safeguard of my affairs, rectify for me my worldly life wherein is my livelihood, rectify for me my Hereafter to which is my return, make life an increase for me in every good, and make death a relief for me from every evil.',
    reference: 'Muslim',
  },
  {
    title: 'Pardon and wellbeing',
    arabic: 'اللَّهُمَّ إِنِّي أَسْأَلُكَ الْعَفْوَ وَالْعَافِيَةَ',
    transliteration: "Allahumma innee as'aluka-l-'afwa wa-l-'aafiyah.",
    translation: 'O Allah, I ask You for pardon and wellbeing.',
    reference: 'Tirmidhi, Abu Dawud',
  },
  {
    title: 'Love of faith and hatred of sin',
    arabic: 'اللَّهُمَّ حَبِّبْ إِلَيْنَا الْإِيمَانَ وَزَيِّنْهُ فِي قُلُوبِنَا وَكَرِّهْ إِلَيْنَا الْكُفْرَ وَالْفُسُوقَ وَالْعِصْيَانَ وَاجْعَلْنَا مِنَ الرَّاشِدِينَ',
    transliteration: 'Allahumma habbib ilaynaa-l-eemaana wa zayyinhhu fee quloobinaa wa karrih ilaynaa-l-kufra wa-l-fusooqa wa-l-\'isyaan waj\'alnaa mina-r-raashideen.',
    translation: 'O Allah, make faith beloved to us and beautify it in our hearts, and make disbelief, sin, and disobedience hateful to us, and make us among the rightly guided.',
    reference: 'Based on Qur\'an 49:7',
  },
  {
    title: 'Unity and love in the home',
    arabic: 'اللَّهُمَّ أَلِّفْ بَيْنَ قُلُوبِنَا وَأَصْلِحْ ذَاتَ بَيْنِنَا',
    transliteration: 'Allahumma allif bayna quloobinaa wa aslih dhaata bayninaa.',
    translation: 'O Allah, bring our hearts together and mend what is between us.',
    reference: 'From authentic Prophetic wording in meaning',
  },
  {
    title: 'Blessing in one\'s family',
    arabic: 'اللَّهُمَّ بَارِكْ لِي فِي أَهْلِي وَوَلَدِي',
    transliteration: 'Allahumma baarik lee fee ahlee wa waladee.',
    translation: 'O Allah, bless me in my family and my children.',
    reference: '',
  },
  {
    title: 'Protection and rectification of one\'s children',
    arabic: 'اللَّهُمَّ احْفَظْ أَوْلَادِي وَأَصْلِحْهُمْ وَاهْدِهِمْ',
    transliteration: 'Allahumma-hfaz awlaadee wa aslihhum wahdihim.',
    translation: 'O Allah, protect my children, rectify them, and guide them.',
    reference: '',
  },
  {
    title: 'A tranquil and faithful home',
    arabic: 'اللَّهُمَّ اجْعَلْ بَيْتَنَا بَيْتَ سَكِينَةٍ وَإِيمَانٍ',
    transliteration: "Allahumma-j'al baytanaa bayta sakeenatin wa eemaan.",
    translation: 'O Allah, make our home a home of tranquility and faith.',
    reference: '',
  },
  {
    title: 'Righteous and beneficial offspring',
    arabic: 'اللَّهُمَّ ارْزُقْنَا ذُرِّيَّةً صَالِحَةً نَافِعَةً',
    transliteration: 'Allahumma-rzuqnaa dhurriyyatan saalihatan naafi\'ah.',
    translation: 'O Allah, grant us righteous and beneficial offspring.',
    reference: '',
  },
];

export const AYAHS = [
  {
    arabic: 'رَبَّنَا هَبْ لَنَا مِنْ أَزْوَاجِنَا وَذُرِّيَّاتِنَا قُرَّةَ أَعْيُنٍ وَاجْعَلْنَا لِلْمُتَّقِينَ إِمَامًا',
    translation: 'Our Lord, grant us from among our wives and offspring comfort to our eyes and make us a leader for the righteous.',
    reference: 'Quran 25:74',
  },
  {
    arabic: 'رَبِّ اجْعَلْنِي مُقِيمَ الصَّلَاةِ وَمِن ذُرِّيَّتِي ۚ رَبَّنَا وَتَقَبَّلْ دُعَاءِ',
    translation: 'My Lord, make me an establisher of prayer, and from my descendants. Our Lord, and accept my supplication.',
    reference: 'Quran 14:40',
  },
  {
    arabic: 'رَبِّ أَوْزِعْنِي أَنْ أَشْكُرَ نِعْمَتَكَ الَّتِي أَنْعَمْتَ عَلَيَّ وَعَلَىٰ وَالِدَيَّ وَأَنْ أَعْمَلَ صَالِحًا تَرْضَاهُ وَأَصْلِحْ لِي فِي ذُرِّيَّتِي',
    translation: 'My Lord, enable me to be grateful for Your favor which You bestowed upon me and upon my parents, and to work righteousness of which You will approve and make righteous for me my offspring.',
    reference: 'Quran 46:15',
  },
  {
    arabic: 'هُنَالِكَ دَعَا زَكَرِيَّا رَبَّهُ ۖ قَالَ رَبِّ هَبْ لِي مِن لَّدُنكَ ذُرِّيَّةً طَيِّبَةً ۖ إِنَّكَ سَمِيعُ الدُّعَاءِ',
    translation: 'At that point Zakariyya called upon his Lord, saying: My Lord, grant me from Yourself a good offspring. Indeed, You are the Hearer of supplication.',
    reference: 'Quran 3:38',
  },
  {
    arabic: 'رَبِّ هَبْ لِي مِنَ الصَّالِحِينَ',
    translation: 'My Lord, grant me from among the righteous.',
    reference: 'Quran 37:100',
  },
  {
    arabic: 'يَا أَيُّهَا الَّذِينَ آمَنُوا قُوا أَنفُسَكُمْ وَأَهْلِيكُمْ نَارًا وَقُودُهَا النَّاسُ وَالْحِجَارَةُ',
    translation: 'O you who have believed, protect yourselves and your families from a Fire whose fuel is people and stones.',
    reference: 'Quran 66:6',
  },
  {
    arabic: 'وَأْمُرْ أَهْلَكَ بِالصَّلَاةِ وَاصْطَبِرْ عَلَيْهَا ۖ لَا نَسْأَلُكَ رِزْقًا ۖ نَّحْنُ نَرْزُقُكَ ۗ وَالْعَاقِبَةُ لِلتَّقْوَىٰ',
    translation: 'And enjoin prayer upon your family and be steadfast therein. We ask you not for provision; We provide for you, and the outcome is for righteousness.',
    reference: 'Quran 20:132',
  },
  {
    arabic: 'وَكَانَ يَأْمُرُ أَهْلَهُ بِالصَّلَاةِ وَالزَّكَاةِ وَكَانَ عِندَ رَبِّهِ مَرْضِيًّا',
    translation: 'And he used to enjoin on his family prayer and zakah and was pleasing to his Lord.',
    reference: 'Quran 19:55',
  },
  {
    arabic: 'وَإِذْ قَالَ لُقْمَانُ لِابْنِهِ وَهُوَ يَعِظُهُ يَا بُنَيَّ لَا تُشْرِكْ بِاللَّهِ ۖ إِنَّ الشِّرْكَ لَظُلْمٌ عَظِيمٌ',
    translation: 'And when Luqman said to his son while he was instructing him: O my son, do not associate anything with Allah. Indeed, association with Him is great injustice.',
    reference: 'Quran 31:13',
  },
  {
    arabic: 'وَوَصَّيْنَا الْإِنسَانَ بِوَالِدَيْهِ حَمَلَتْهُ أُمُّهُ وَهْنًا عَلَىٰ وَهْنٍ وَفِصَالُهُ فِي عَامَيْنِ أَنِ اشْكُرْ لِي وَلِوَالِدَيْكَ إِلَيَّ الْمَصِيرُ',
    translation: 'And We have enjoined upon man care for his parents. His mother carried him, increasing her in weakness upon weakness, and his weaning is in two years. Be grateful to Me and to your parents; to Me is the final destination.',
    reference: 'Quran 31:14',
  },
  {
    arabic: 'يَا بُنَيَّ إِنَّهَا إِن تَكُ مِثْقَالَ حَبَّةٍ مِّنْ خَرْدَلٍ فَتَكُن فِي صَخْرَةٍ أَوْ فِي السَّمَاوَاتِ أَوْ فِي الْأَرْضِ يَأْتِ بِهَا اللَّهُ ۚ إِنَّ اللَّهَ لَطِيفٌ خَبِيرٌ',
    translation: 'O my son, if a wrong should be the weight of a mustard seed and should be within a rock or anywhere in the heavens or earth, Allah will bring it forth. Indeed, Allah is Subtle and Aware.',
    reference: 'Quran 31:16',
  },
  {
    arabic: 'يَا بُنَيَّ أَقِمِ الصَّلَاةَ وَأْمُرْ بِالْمَعْرُوفِ وَانْهَ عَنِ الْمُنكَرِ وَاصْبِرْ عَلَىٰ مَا أَصَابَكَ ۖ إِنَّ ذَٰلِكَ مِنْ عَزْمِ الْأُمُورِ',
    translation: 'O my son, establish prayer, enjoin what is right, forbid what is wrong, and be patient over what befalls you. Indeed, that is of the matters requiring resolve.',
    reference: 'Quran 31:17',
  },
  {
    arabic: 'وَلَا تُصَعِّرْ خَدَّكَ لِلنَّاسِ وَلَا تَمْشِ فِي الْأَرْضِ مَرَحًا ۖ إِنَّ اللَّهَ لَا يُحِبُّ كُلَّ مُخْتَالٍ فَخُورٍ',
    translation: 'And do not turn your cheek in contempt toward people and do not walk through the earth exultantly. Indeed, Allah does not like everyone self-deluded and boastful.',
    reference: 'Quran 31:18',
  },
  {
    arabic: 'وَاقْصِدْ فِي مَشْيِكَ وَاغْضُضْ مِن صَوْتِكَ ۚ إِنَّ أَنكَرَ الْأَصْوَاتِ لَصَوْتُ الْحَمِيرِ',
    translation: 'And be moderate in your pace and lower your voice; indeed, the most disagreeable of sounds is the voice of donkeys.',
    reference: 'Quran 31:19',
  },
  {
    arabic: 'وَقَضَىٰ رَبُّكَ أَلَّا تَعْبُدُوا إِلَّا إِيَّاهُ وَبِالْوَالِدَيْنِ إِحْسَانًا ۚ إِمَّا يَبْلُغَنَّ عِندَكَ الْكِبَرَ أَحَدُهُمَا أَوْ كِلَاهُمَا فَلَا تَقُل لَّهُمَا أُفٍّ وَلَا تَنْهَرْهُمَا وَقُل لَّهُمَا قَوْلًا كَرِيمًا',
    translation: 'Your Lord has decreed that you worship none but Him, and to parents good treatment. Whether one or both of them reach old age with you, say not to them a word of disrespect and do not repel them, but speak to them a noble word.',
    reference: 'Quran 17:23',
  },
  {
    arabic: 'وَاخْفِضْ لَهُمَا جَنَاحَ الذُّلِّ مِنَ الرَّحْمَةِ وَقُل رَّبِّ ارْحَمْهُمَا كَمَا رَبَّيَانِي صَغِيرًا',
    translation: 'And lower to them the wing of humility out of mercy and say: My Lord, have mercy upon them as they brought me up when I was small.',
    reference: 'Quran 17:24',
  },
  {
    arabic: 'وَمِنْ آيَاتِهِ أَنْ خَلَقَ لَكُم مِّنْ أَنفُسِكُمْ أَزْوَاجًا لِّتَسْكُنُوا إِلَيْهَا وَجَعَلَ بَيْنَكُم مَّوَدَّةً وَرَحْمَةً ۚ إِنَّ فِي ذَٰلِكَ لَآيَاتٍ لِّقَوْمٍ يَتَفَكَّرُونَ',
    translation: 'And of His signs is that He created for you from yourselves mates that you may find tranquility in them; and He placed between you affection and mercy. Indeed in that are signs for a people who give thought.',
    reference: 'Quran 30:21',
  },
  {
    arabic: 'يَا أَيُّهَا النَّاسُ اتَّقُوا رَبَّكُمُ الَّذِي خَلَقَكُم مِّن نَّفْسٍ وَاحِدَةٍ وَخَلَقَ مِنْهَا زَوْجَهَا وَبَثَّ مِنْهُمَا رِجَالًا كَثِيرًا وَنِسَاءً ۚ وَاتَّقُوا اللَّهَ الَّذِي تَسَاءَلُونَ بِهِ وَالْأَرْحَامَ',
    translation: 'O mankind, fear your Lord, who created you from one soul and created from it its mate and dispersed from both of them many men and women. And fear Allah, through whom you ask one another, and the wombs.',
    reference: 'Quran 4:1',
  },
  {
    arabic: 'هُنَّ لِبَاسٌ لَّكُمْ وَأَنتُمْ لِبَاسٌ لَّهُنَّ',
    translation: 'They are clothing for you and you are clothing for them.',
    reference: 'Quran 2:187',
  },
  {
    arabic: 'وَعَاشِرُوهُنَّ بِالْمَعْرُوفِ ۚ فَإِن كَرِهْتُمُوهُنَّ فَعَسَىٰ أَن تَكْرَهُوا شَيْئًا وَيَجْعَلَ اللَّهُ فِيهِ خَيْرًا كَثِيرًا',
    translation: 'And live with them in kindness. For if you dislike them — perhaps you dislike a thing and Allah makes therein much good.',
    reference: 'Quran 4:19',
  },
  {
    arabic: 'وَلَهُنَّ مِثْلُ الَّذِي عَلَيْهِنَّ بِالْمَعْرُوفِ ۚ وَلِلرِّجَالِ عَلَيْهِنَّ دَرَجَةٌ ۗ وَاللَّهُ عَزِيزٌ حَكِيمٌ',
    translation: 'And due to them is similar to what is expected of them, according to what is reasonable. And men have a degree of responsibility over them. And Allah is Exalted in Might and Wise.',
    reference: 'Quran 2:228',
  },
  {
    arabic: 'لِلَّهِ مُلْكُ السَّمَاوَاتِ وَالْأَرْضِ ۚ يَخْلُقُ مَا يَشَاءُ ۚ يَهَبُ لِمَن يَشَاءُ إِنَاثًا وَيَهَبُ لِمَن يَشَاءُ الذُّكُورَ ۞ أَوْ يُزَوِّجُهُمْ ذُكْرَانًا وَإِنَاثًا ۖ وَيَجْعَلُ مَن يَشَاءُ عَقِيمًا ۚ إِنَّهُ عَلِيمٌ قَدِيرٌ',
    translation: 'To Allah belongs the dominion of the heavens and the earth. He gives to whom He wills female children, and He gives to whom He wills males, or He makes them both males and females, and He renders whom He wills barren. Indeed, He is Knowing and Competent.',
    reference: 'Quran 42:49-50',
  },
  {
    arabic: 'وَاعْلَمُوا أَنَّمَا أَمْوَالُكُمْ وَأَوْلَادُكُمْ فِتْنَةٌ وَأَنَّ اللَّهَ عِندَهُ أَجْرٌ عَظِيمٌ',
    translation: 'And know that your wealth and your children are but a trial and that Allah has with Him a great reward.',
    reference: 'Quran 8:28',
  },
  {
    arabic: 'إِنَّمَا أَمْوَالُكُمْ وَأَوْلَادُكُمْ فِتْنَةٌ ۚ وَاللَّهُ عِندَهُ أَجْرٌ عَظِيمٌ',
    translation: 'Your wealth and your children are only a trial, and Allah has with Him a great reward.',
    reference: 'Quran 64:15',
  },
  {
    arabic: 'الْمَالُ وَالْبَنُونَ زِينَةُ الْحَيَاةِ الدُّنْيَا ۖ وَالْبَاقِيَاتُ الصَّالِحَاتُ خَيْرٌ عِندَ رَبِّكَ ثَوَابًا وَخَيْرٌ أَمَلًا',
    translation: 'Wealth and children are the adornment of worldly life. But the enduring good deeds are better to your Lord in reward and better in hope.',
    reference: 'Quran 18:46',
  },
  {
    arabic: 'وَوَصَّىٰ بِهَا إِبْرَاهِيمُ بَنِيهِ وَيَعْقُوبُ يَا بَنِيَّ إِنَّ اللَّهَ اصْطَفَىٰ لَكُمُ الدِّينَ فَلَا تَمُوتُنَّ إِلَّا وَأَنتُم مُّسْلِمُونَ ۞ أَمْ كُنتُمْ شُهَدَاءَ إِذْ حَضَرَ يَعْقُوبَ الْمَوْتُ إِذْ قَالَ لِبَنِيهِ مَا تَعْبُدُونَ مِن بَعْدِي قَالُوا نَعْبُدُ إِلَٰهَكَ وَإِلَٰهَ آبَائِكَ إِبْرَاهِيمَ وَإِسْمَاعِيلَ وَإِسْحَاقَ إِلَٰهًا وَاحِدًا وَنَحْنُ لَهُ مُسْلِمُونَ',
    translation: 'Abraham instructed his sons and so did Jacob: O my sons, indeed Allah has chosen for you this religion, so do not die except while you are Muslims. When death approached Jacob, he said to his sons: What will you worship after me? They said: We will worship your God and the God of your fathers — one God. And we are Muslims in submission to Him.',
    reference: 'Quran 2:132-133',
  },
  {
    arabic: 'فَلَمَّا بَلَغَ مَعَهُ السَّعْيَ قَالَ يَا بُنَيَّ إِنِّي أَرَىٰ فِي الْمَنَامِ أَنِّي أَذْبَحُكَ فَانظُرْ مَاذَا تَرَىٰ ۚ قَالَ يَا أَبَتِ افْعَلْ مَا تُؤْمَرُ ۖ سَتَجِدُنِي إِن شَاءَ اللَّهُ مِنَ الصَّابِرِينَ',
    translation: 'When he reached the age of striving with him, he said: O my son, I have seen in a dream that I sacrifice you, so see what you think. He said: O my father, do as you are commanded. You will find me, if Allah wills, of the steadfast.',
    reference: 'Quran 37:102',
  },
  {
    arabic: 'إِذْ قَالَ يُوسُفُ لِأَبِيهِ يَا أَبَتِ إِنِّي رَأَيْتُ أَحَدَ عَشَرَ كَوْكَبًا وَالشَّمْسَ وَالْقَمَرَ رَأَيْتُهُمْ لِي سَاجِدِينَ ۞ قَالَ يَا بُنَيَّ لَا تَقْصُصْ رُؤْيَاكَ عَلَىٰ إِخْوَتِكَ فَيَكِيدُوا لَكَ كَيْدًا ۖ إِنَّ الشَّيْطَانَ لِلْإِنسَانِ عَدُوٌّ مُّبِينٌ',
    translation: 'When Joseph said to his father: O my father, I saw eleven stars and the sun and the moon prostrating to me. He said: O my son, do not relate your vision to your brothers or they will conspire against you. Indeed Satan is to man a clear enemy.',
    reference: 'Quran 12:4-6',
  },
  {
    arabic: 'قُل لِّلْمُؤْمِنِينَ يَغُضُّوا مِنْ أَبْصَارِهِمْ وَيَحْفَظُوا فُرُوجَهُمْ ۚ ذَٰلِكَ أَزْكَىٰ لَهُمْ ۗ إِنَّ اللَّهَ خَبِيرٌ بِمَا يَصْنَعُونَ ۞ وَقُل لِّلْمُؤْمِنَاتِ يَغْضُضْنَ مِنْ أَبْصَارِهِنَّ وَيَحْفَظْنَ فُرُوجَهُنَّ وَلَا يُبْدِينَ زِينَتَهُنَّ إِلَّا مَا ظَهَرَ مِنْهَا',
    translation: 'Tell the believing men to lower their gaze and guard their private parts — that is purer for them. And tell the believing women to lower their gaze and guard their private parts and not expose their adornment except that which appears thereof.',
    reference: 'Quran 24:30-31',
  },
  {
    arabic: 'يَا أَيُّهَا الَّذِينَ آمَنُوا لِيَسْتَأْذِنكُمُ الَّذِينَ مَلَكَتْ أَيْمَانُكُمْ وَالَّذِينَ لَمْ يَبْلُغُوا الْحُلُمَ مِنكُمْ ثَلَاثَ مَرَّاتٍ ۚ وَإِذَا بَلَغَ الْأَطْفَالُ مِنكُمُ الْحُلُمَ فَلْيَسْتَأْذِنُوا كَمَا اسْتَأْذَنَ الَّذِينَ مِن قَبْلِهِمْ',
    translation: 'O you who have believed, let those who have not yet reached puberty ask your permission at three times. And when the children among you reach puberty, let them ask permission as those before them did. Thus does Allah make clear to you His verses.',
    reference: 'Quran 24:58-59',
  },
  {
    arabic: 'وَلَا تَقْرَبُوا الزِّنَىٰ ۖ إِنَّهُ كَانَ فَاحِشَةً وَسَاءَ سَبِيلًا',
    translation: 'And do not approach unlawful sexual intercourse. Indeed, it is ever an immorality and is evil as a way.',
    reference: 'Quran 17:32',
  },
  {
    arabic: 'قُلْ تَعَالَوْا أَتْلُ مَا حَرَّمَ رَبُّكُمْ عَلَيْكُمْ ۖ أَلَّا تُشْرِكُوا بِهِ شَيْئًا ۖ وَبِالْوَالِدَيْنِ إِحْسَانًا ۖ وَلَا تَقْتُلُوا أَوْلَادَكُم مِّنْ إِمْلَاقٍ ۖ نَّحْنُ نَرْزُقُكُمْ وَإِيَّاهُمْ',
    translation: 'Say: Come, I will recite what your Lord has prohibited: that you not associate anything with Him, and to parents good treatment, and do not kill your children out of poverty — We will provide for you and them.',
    reference: 'Quran 6:151',
  },
  {
    arabic: 'يَا أَيُّهَا الَّذِينَ آمَنُوا كُونُوا قَوَّامِينَ بِالْقِسْطِ شُهَدَاءَ لِلَّهِ وَلَوْ عَلَىٰ أَنفُسِكُمْ أَوِ الْوَالِدَيْنِ وَالْأَقْرَبِينَ',
    translation: 'O you who have believed, be persistently standing firm in justice, witnesses for Allah, even if it be against yourselves or parents and relatives.',
    reference: 'Quran 4:135',
  },
  {
    arabic: 'يَا أَيُّهَا الَّذِينَ آمَنُوا كُونُوا قَوَّامِينَ لِلَّهِ شُهَدَاءَ بِالْقِسْطِ ۖ وَلَا يَجْرِمَنَّكُمْ شَنَآنُ قَوْمٍ عَلَىٰ أَلَّا تَعْدِلُوا ۚ اعْدِلُوا هُوَ أَقْرَبُ لِلتَّقْوَىٰ',
    translation: 'O you who have believed, be persistently standing firm for Allah, witnesses in justice, and do not let hatred of a people prevent you from being just. Be just; that is nearer to righteousness.',
    reference: 'Quran 5:8',
  },
  {
    arabic: 'يَا أَيُّهَا الَّذِينَ آمَنُوا لَا يَسْخَرْ قَوْمٌ مِّن قَوْمٍ عَسَىٰ أَن يَكُونُوا خَيْرًا مِّنْهُمْ ۖ وَلَا تَلْمِزُوا أَنفُسَكُمْ وَلَا تَنَابَزُوا بِالْأَلْقَابِ ۞ يَا أَيُّهَا الَّذِينَ آمَنُوا اجْتَنِبُوا كَثِيرًا مِّنَ الظَّنِّ إِنَّ بَعْضَ الظَّنِّ إِثْمٌ ۖ وَلَا تَجَسَّسُوا وَلَا يَغْتَب بَّعْضُكُم بَعْضًا',
    translation: 'O you who have believed, let not a people ridicule another people — perhaps they may be better than them. And do not insult one another or call each other offensive names. And avoid much negative assumption, for indeed some assumption is sin. And do not spy or backbite one another.',
    reference: 'Quran 49:11-12',
  },
  {
    arabic: 'وَالْوَالِدَاتُ يُرْضِعْنَ أَوْلَادَهُنَّ حَوْلَيْنِ كَامِلَيْنِ ۖ لِمَنْ أَرَادَ أَن يُتِمَّ الرَّضَاعَةَ ۚ وَعَلَى الْمَوْلُودِ لَهُ رِزْقُهُنَّ وَكِسْوَتُهُنَّ بِالْمَعْرُوفِ',
    translation: 'Mothers may nurse their children two complete years for whoever wishes to complete the nursing. Upon the father is the mothers\' provision and their clothing according to what is acceptable.',
    reference: 'Quran 2:233',
  },
  {
    arabic: 'أَسْكِنُوهُنَّ مِنْ حَيْثُ سَكَنتُم مِّن وُجْدِكُمْ وَلَا تُضَارُّوهُنَّ لِتُضَيِّقُوا عَلَيْهِنَّ ۚ وَإِن كُنَّ أُولَاتِ حَمْلٍ فَأَنفِقُوا عَلَيْهِنَّ ۞ لِيُنفِقْ ذُو سَعَةٍ مِّن سَعَتِهِ ۖ وَمَن قُدِرَ عَلَيْهِ رِزْقُهُ فَلْيُنفِقْ مِمَّا آتَاهُ اللَّهُ',
    translation: 'Lodge them where you dwell, according to your means, and do not harm them in order to oppress them. And if they are pregnant, spend on them until they deliver. Let a man of wealth spend from his wealth, and he whose provision is restricted — let him spend from what Allah has given him.',
    reference: 'Quran 65:6-7',
  },
  {
    arabic: 'وَإِنْ خِفْتُمْ شِقَاقَ بَيْنِهِمَا فَابْعَثُوا حَكَمًا مِّنْ أَهْلِهِ وَحَكَمًا مِّنْ أَهْلِهَا ۚ إِن يُرِيدَا إِصْلَاحًا يُوَفِّقِ اللَّهُ بَيْنَهُمَا ۗ إِنَّ اللَّهَ كَانَ عَلِيمًا خَبِيرًا',
    translation: 'And if you fear dissension between a couple, send an arbitrator from his family and an arbitrator from her family. If they both desire reconciliation, Allah will cause it between them. Indeed, Allah is ever Knowing and Aware.',
    reference: 'Quran 4:35',
  },
  {
    arabic: 'وَآتُوا الْيَتَامَىٰ أَمْوَالَهُمْ ۖ وَلَا تَتَبَدَّلُوا الْخَبِيثَ بِالطَّيِّبِ ۖ وَلَا تَأْكُلُوا أَمْوَالَهُمْ إِلَىٰ أَمْوَالِكُمْ ۚ إِنَّهُ كَانَ حُوبًا كَبِيرًا',
    translation: 'And give to the orphans their properties and do not substitute the defective for the good. And do not consume their properties by adding them to your own. Indeed, that is ever a great sin.',
    reference: 'Quran 4:2',
  },
  {
    arabic: 'وَابْتَلُوا الْيَتَامَىٰ حَتَّىٰ إِذَا بَلَغُوا النِّكَاحَ فَإِنْ آنَسْتُم مِّنْهُمْ رُشْدًا فَادْفَعُوا إِلَيْهِمْ أَمْوَالَهُمْ',
    translation: 'And test the orphans until they reach marriageable age. Then if you perceive in them sound judgement, release their property to them.',
    reference: 'Quran 4:6',
  },
  {
    arabic: 'وَلْيَخْشَ الَّذِينَ لَوْ تَرَكُوا مِنْ خَلْفِهِمْ ذُرِّيَّةً ضِعَافًا خَافُوا عَلَيْهِمْ فَلْيَتَّقُوا اللَّهَ وَلْيَقُولُوا قَوْلًا سَدِيدًا',
    translation: 'And let those fear who, if they left behind weak offspring, would fear for them. Let them fear Allah and speak words of appropriate justice.',
    reference: 'Quran 4:9',
  },
  {
    arabic: 'وَمَا أَدْرَاكَ مَا الْعَقَبَةُ ۞ فَكُّ رَقَبَةٍ ۞ أَوْ إِطْعَامٌ فِي يَوْمٍ ذِي مَسْغَبَةٍ ۞ يَتِيمًا ذَا مَقْرَبَةٍ ۞ أَوْ مِسْكِينًا ذَا مَتْرَبَةٍ',
    translation: 'And what can make you know what is the difficult pass? It is the freeing of a slave, or feeding on a day of severe hunger an orphan of near relationship, or a needy person in misery.',
    reference: 'Quran 90:12-16',
  },
  {
    arabic: 'فَأَمَّا الْيَتِيمَ فَلَا تَقْهَرْ',
    translation: 'So as for the orphan, do not oppress him.',
    reference: 'Quran 93:9',
  },
  {
    arabic: 'فَهَلْ عَسَيْتُمْ إِن تَوَلَّيْتُمْ أَن تُفْسِدُوا فِي الْأَرْضِ وَتُقَطِّعُوا أَرْحَامَكُمْ ۞ أُولَٰئِكَ الَّذِينَ لَعَنَهُمُ اللَّهُ فَأَصَمَّهُمْ وَأَعْمَىٰ أَبْصَارَهُمْ',
    translation: 'So would you perhaps, if you turned away, cause corruption on earth and sever your family ties? Those are the ones Allah has cursed, so He deafened them and blinded their vision.',
    reference: 'Quran 47:22-23',
  },
  {
    arabic: 'وَالَّذِينَ يَصِلُونَ مَا أَمَرَ اللَّهُ بِهِ أَن يُوصَلَ وَيَخْشَوْنَ رَبَّهُمْ وَيَخَافُونَ سُوءَ الْحِسَابِ',
    translation: 'And those who join what Allah has ordered to be joined and fear their Lord and are afraid of the evil of the final account.',
    reference: 'Quran 13:21',
  },
  {
    arabic: 'يَا يَحْيَىٰ خُذِ الْكِتَابَ بِقُوَّةٍ ۖ وَآتَيْنَاهُ الْحُكْمَ صَبِيًّا ۞ وَحَنَانًا مِّن لَّدُنَّا وَزَكَاةً ۖ وَكَانَ تَقِيًّا ۞ وَبَرًّا بِوَالِدَيْهِ وَلَمْ يَكُن جَبَّارًا عَصِيًّا ۞ وَسَلَامٌ عَلَيْهِ يَوْمَ وُلِدَ وَيَوْمَ يَمُوتُ وَيَوْمَ يُبْعَثُ حَيًّا',
    translation: 'O Yahya, take the Scripture with determination. And We gave him wisdom while yet a boy, and purity and righteousness — and he was fearing of Allah and dutiful to his parents, and was not a disobedient tyrant. And peace be upon him the day he was born and the day he dies and the day he is raised alive.',
    reference: 'Quran 19:12-15',
  },
  {
    arabic: 'إِذْ قَالَتِ امْرَأَتُ عِمْرَانَ رَبِّ إِنِّي نَذَرْتُ لَكَ مَا فِي بَطْنِي مُحَرَّرًا فَتَقَبَّلْ مِنِّي ۖ إِنَّكَ أَنتَ السَّمِيعُ الْعَلِيمُ ۞ فَلَمَّا وَضَعَتْهَا قَالَتْ رَبِّ إِنِّي وَضَعْتُهَا أُنثَىٰ ۖ وَإِنِّي سَمَّيْتُهَا مَرْيَمَ وَإِنِّي أُعِيذُهَا بِكَ وَذُرِّيَّتَهَا مِنَ الشَّيْطَانِ الرَّجِيمِ ۞ فَتَقَبَّلَهَا رَبُّهَا بِقَبُولٍ حَسَنٍ وَأَنبَتَهَا نَبَاتًا حَسَنًا',
    translation: 'The wife of Imran said: My Lord, I have pledged what is in my womb consecrated for Your service, so accept this from me. When she delivered, she said: My Lord, I have delivered a female... I have named her Mary, and I seek refuge for her and her descendants from Satan. So her Lord accepted her with good acceptance and caused her to grow in a good manner.',
    reference: 'Quran 3:35-37',
  },
  {
    arabic: 'قَالَ لَا تَثْرِيبَ عَلَيْكُمُ الْيَوْمَ ۖ يَغْفِرُ اللَّهُ لَكُمْ ۖ وَهُوَ أَرْحَمُ الرَّاحِمِينَ',
    translation: 'He said: No blame will there be upon you today. Allah will forgive you, and He is the most merciful of the merciful.',
    reference: 'Quran 12:92',
  },
  {
    arabic: 'وَنَادَىٰ نُوحٌ ابْنَهُ وَكَانَ فِي مَعْزِلٍ يَا بُنَيَّ ارْكَب مَّعَنَا وَلَا تَكُن مَّعَ الْكَافِرِينَ ۞ وَنَادَىٰ نُوحٌ رَّبَّهُ فَقَالَ رَبِّ إِنَّ ابْنِي مِنْ أَهْلِي وَإِنَّ وَعْدَكَ الْحَقُّ وَأَنتَ أَحْكَمُ الْحَاكِمِينَ',
    translation: 'Noah called to his son who was apart: O my son, come aboard with us and be not with the disbelievers. And Noah called to his Lord: My Lord, indeed my son is of my family, and indeed Your promise is true, and You are the most just of judges.',
    reference: 'Quran 11:42-45',
  },
  {
    arabic: 'ضَرَبَ اللَّهُ مَثَلًا لِّلَّذِينَ آمَنُوا امْرَأَتَ فِرْعَوْنَ إِذْ قَالَتْ رَبِّ ابْنِ لِي عِندَكَ بَيْتًا فِي الْجَنَّةِ وَنَجِّنِي مِن فِرْعَوْنَ وَعَمَلِهِ وَنَجِّنِي مِنَ الْقَوْمِ الظَّالِمِينَ',
    translation: 'Allah presents an example of those who believed: the wife of Pharaoh, when she said: My Lord, build for me near You a house in Paradise and save me from Pharaoh and his deeds and save me from the wrongdoing people.',
    reference: 'Quran 66:11',
  },
  {
    arabic: 'فَبِمَا رَحْمَةٍ مِّنَ اللَّهِ لِنتَ لَهُمْ ۖ وَلَوْ كُنتَ فَظًّا غَلِيظَ الْقَلْبِ لَانفَضُّوا مِنْ حَوْلِكَ ۖ فَاعْفُ عَنْهُمْ وَاسْتَغْفِرْ لَهُمْ وَشَاوِرْهُمْ فِي الْأَمْرِ',
    translation: 'So by mercy from Allah, you were lenient with them. Had you been harsh and hard-hearted, they would have dispersed from around you. So pardon them and ask forgiveness for them and consult them in the matter.',
    reference: 'Quran 3:159',
  },
  {
    arabic: 'فَقُولَا لَهُ قَوْلًا لَّيِّنًا لَّعَلَّهُ يَتَذَكَّرُ أَوْ يَخْشَىٰ',
    translation: 'And speak to him with gentle speech that perhaps he may be reminded or fear.',
    reference: 'Quran 20:44',
  },
  {
    arabic: 'وَبِالْوَالِدَيْنِ إِحْسَانًا وَذِي الْقُرْبَىٰ وَالْيَتَامَىٰ وَالْمَسَاكِينِ وَقُولُوا لِلنَّاسِ حُسْنًا وَأَقِيمُوا الصَّلَاةَ وَآتُوا الزَّكَاةَ',
    translation: 'And be good to parents, relatives, orphans, and the needy. And speak to people good words and establish prayer and give zakah.',
    reference: 'Quran 2:83',
  },
  {
    arabic: 'وَقُل لِّعِبَادِي يَقُولُوا الَّتِي هِيَ أَحْسَنُ ۚ إِنَّ الشَّيْطَانَ يَنزَغُ بَيْنَهُمْ ۚ إِنَّ الشَّيْطَانَ كَانَ لِلْإِنسَانِ عَدُوًّا مُّبِينًا',
    translation: 'And tell My servants to say that which is best. Indeed, Satan induces disagreement among them. Indeed Satan is ever, to mankind, a clear enemy.',
    reference: 'Quran 17:53',
  },
  {
    arabic: 'وَلَقَدْ آتَيْنَا لُقْمَانَ الْحِكْمَةَ أَنِ اشْكُرْ لِلَّهِ ۚ وَمَن يَشْكُرْ فَإِنَّمَا يَشْكُرُ لِنَفْسِهِ ۖ وَمَن كَفَرَ فَإِنَّ اللَّهَ غَنِيٌّ حَمِيدٌ',
    translation: 'And We had certainly given Luqman wisdom: Be grateful to Allah. And whoever is grateful is grateful for the benefit of himself. And whoever denies His favor — then indeed, Allah is Free of need and Praiseworthy.',
    reference: 'Quran 31:12',
  },
  {
    arabic: 'وَالْعَصْرِ ۞ إِنَّ الْإِنسَانَ لَفِي خُسْرٍ ۞ إِلَّا الَّذِينَ آمَنُوا وَعَمِلُوا الصَّالِحَاتِ وَتَوَاصَوْا بِالْحَقِّ وَتَوَاصَوْا بِالصَّبْرِ',
    translation: 'By time, indeed mankind is in loss — except for those who have believed and done righteous deeds and advised each other to truth and advised each other to patience.',
    reference: 'Quran 103:1-3',
  },
  {
    arabic: 'يَا أَيُّهَا الَّذِينَ آمَنُوا اسْتَعِينُوا بِالصَّبْرِ وَالصَّلَاةِ ۚ إِنَّ اللَّهَ مَعَ الصَّابِرِينَ',
    translation: 'O you who have believed, seek help through patience and prayer. Indeed, Allah is with the patient.',
    reference: 'Quran 2:153',
  },
];

export function getDailyDua() {
  return pickByDay(DUAS);
}

export function getDailyAyah() {
  return pickByDay(PASSAGES);
}
