// Rotates by day-of-year so each day shows a different entry
function pickByDay(arr) {
  const start = new Date(new Date().getFullYear(), 0, 0);
  const diff = new Date() - start;
  const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24));
  return arr[dayOfYear % arr.length];
}

export const DUAS = [
  {
    arabic: 'رَبِّ اجْعَلْنِي مُقِيمَ الصَّلَاةِ وَمِن ذُرِّيَّتِي ۚ رَبَّنَا وَتَقَبَّلْ دُعَاءِ',
    transliteration: "Rabbi aj'alni muqeemas-salaati wa min dhurriyyati, Rabbana wa taqabbal du'a'",
    translation: 'My Lord, make me an establisher of prayer, and from my descendants. Our Lord, and accept my supplication.',
    reference: 'Quran 14:40',
  },
  {
    arabic: 'رَبَّنَا هَبْ لَنَا مِنْ أَزْوَاجِنَا وَذُرِّيَّاتِنَا قُرَّةَ أَعْيُنٍ وَاجْعَلْنَا لِلْمُتَّقِينَ إِمَامًا',
    transliteration: "Rabbana hab lana min azwajina wa dhurriyyatina qurrata a'yunin waj'alna lil-muttaqeena imama",
    translation: 'Our Lord, grant us from among our wives and offspring comfort to our eyes and make us an example for the righteous.',
    reference: 'Quran 25:74',
  },
  {
    arabic: 'رَبِّ أَوْزِعْنِي أَنْ أَشْكُرَ نِعْمَتَكَ الَّتِي أَنْعَمْتَ عَلَيَّ وَعَلَىٰ وَالِدَيَّ وَأَنْ أَعْمَلَ صَالِحًا تَرْضَاهُ وَأَصْلِحْ لِي فِي ذُرِّيَّتِي',
    transliteration: "Rabbi awzi'ni an ashkura ni'matakal-lati an'amta 'alayya wa 'ala walidayya wa an a'mala salihan tardahu wa aslih li fi dhurriyyati",
    translation: 'My Lord, enable me to be grateful for Your favor which You have bestowed upon me and upon my parents, and to work righteousness of which You will approve and make righteous for me my offspring.',
    reference: 'Quran 46:15',
  },
  {
    arabic: 'اللَّهُمَّ إِنِّي أَعُوذُ بِكَ مِنَ الْعَجْزِ وَالْكَسَلِ وَالْجُبْنِ وَالْهَرَمِ وَالْبُخْلِ',
    transliteration: "Allahumma inni a'udhu bika minal-'ajzi wal-kasali wal-jubni wal-harami wal-bukhli",
    translation: 'O Allah, I seek refuge in You from incapacity, laziness, cowardice, old age, and miserliness.',
    reference: 'Sahih Muslim',
  },
  {
    arabic: 'رَبِّ زِدْنِي عِلْمًا',
    transliteration: "Rabbi zidni 'ilma",
    translation: 'My Lord, increase me in knowledge.',
    reference: 'Quran 20:114',
  },
  {
    arabic: 'اللَّهُمَّ أَصْلِحْ لِي دِينِي الَّذِي هُوَ عِصْمَةُ أَمْرِي، وَأَصْلِحْ لِي دُنْيَايَ الَّتِي فِيهَا مَعَاشِي',
    transliteration: "Allahumma aslih li dini alladhi huwa 'ismatu amri, wa aslih li dunyaya allati fiha ma'ashi",
    translation: 'O Allah, set right my religion which is the safeguard of my affairs, and set right my worldly affairs wherein is my livelihood.',
    reference: 'Sahih Muslim',
  },
  {
    arabic: 'رَبَّنَا آتِنَا فِي الدُّنْيَا حَسَنَةً وَفِي الْآخِرَةِ حَسَنَةً وَقِنَا عَذَابَ النَّارِ',
    transliteration: "Rabbana atina fid-dunya hasanatan wa fil-akhirati hasanatan wa qina 'adhaban-nar",
    translation: 'Our Lord, give us in this world that which is good and in the Hereafter that which is good, and protect us from the punishment of the Fire.',
    reference: 'Quran 2:201',
  },
  {
    arabic: 'اللَّهُمَّ إِنِّي أَسْأَلُكَ الْهُدَى وَالتُّقَى وَالْعَفَافَ وَالْغِنَى',
    transliteration: "Allahumma inni as'alukal-huda wat-tuqa wal-'afafa wal-ghina",
    translation: 'O Allah, I ask You for guidance, piety, chastity, and self-sufficiency.',
    reference: 'Sahih Muslim',
  },
  {
    arabic: 'يَا مُقَلِّبَ الْقُلُوبِ ثَبِّتْ قَلْبِي عَلَى دِينِكَ',
    transliteration: "Ya Muqallibal-qulub, thabbit qalbi 'ala dinik",
    translation: 'O Turner of hearts, keep my heart firm upon Your religion.',
    reference: 'Jami at-Tirmidhi',
  },
  {
    arabic: 'اللَّهُمَّ أَعِنِّي عَلَى ذِكْرِكَ وَشُكْرِكَ وَحُسْنِ عِبَادَتِكَ',
    transliteration: "Allahumma a'inni 'ala dhikrika wa shukrika wa husni 'ibadatik",
    translation: 'O Allah, help me to remember You, to be grateful to You, and to worship You in an excellent manner.',
    reference: 'Sunan Abu Dawud',
  },
];

export const AYAHS = [
  {
    arabic: 'وَوَصَّيْنَا الْإِنسَانَ بِوَالِدَيْهِ حَمَلَتْهُ أُمُّهُ وَهْنًا عَلَىٰ وَهْنٍ',
    translation: 'And We have enjoined upon man care for his parents. His mother carried him, increasing her in weakness upon weakness.',
    reference: 'Quran 31:14',
  },
  {
    arabic: 'يَا أَيُّهَا الَّذِينَ آمَنُوا قُوا أَنفُسَكُمْ وَأَهْلِيكُمْ نَارًا',
    translation: 'O you who have believed, protect yourselves and your families from a Fire.',
    reference: 'Quran 66:6',
  },
  {
    arabic: 'لَقَدْ كَانَ لَكُمْ فِي رَسُولِ اللَّهِ أُسْوَةٌ حَسَنَةٌ',
    translation: 'There has certainly been for you in the Messenger of Allah an excellent example.',
    reference: 'Quran 33:21',
  },
  {
    arabic: 'وَاخْفِضْ لَهُمَا جَنَاحَ الذُّلِّ مِنَ الرَّحْمَةِ وَقُل رَّبِّ ارْحَمْهُمَا كَمَا رَبَّيَانِي صَغِيرًا',
    translation: 'And lower to them the wing of humility out of mercy and say: My Lord, have mercy upon them as they brought me up when I was small.',
    reference: 'Quran 17:24',
  },
  {
    arabic: 'الْمَالُ وَالْبَنُونَ زِينَةُ الْحَيَاةِ الدُّنْيَا ۖ وَالْبَاقِيَاتُ الصَّالِحَاتُ خَيْرٌ عِندَ رَبِّكَ',
    translation: 'Wealth and children are the adornment of worldly life. But the enduring good deeds are better to your Lord in reward.',
    reference: 'Quran 18:46',
  },
  {
    arabic: 'إِنَّ مَعَ الْعُسْرِ يُسْرًا',
    translation: 'Indeed, with hardship will be ease.',
    reference: 'Quran 94:6',
  },
  {
    arabic: 'وَعَلَّمَ آدَمَ الْأَسْمَاءَ كُلَّهَا',
    translation: 'And He taught Adam the names of all things.',
    reference: 'Quran 2:31',
  },
  {
    arabic: 'وَقُل رَّبِّ أَدْخِلْنِي مُدْخَلَ صِدْقٍ وَأَخْرِجْنِي مُخْرَجَ صِدْقٍ',
    translation: 'And say: My Lord, cause me to enter a truthful entrance and to exit a truthful exit.',
    reference: 'Quran 17:80',
  },
  {
    arabic: 'فَأَمَّا الْيَتِيمَ فَلَا تَقْهَرْ ۞ وَأَمَّا السَّائِلَ فَلَا تَنْهَرْ',
    translation: 'So as for the orphan, do not oppress him. And as for the petitioner, do not repel him.',
    reference: 'Quran 93:9-10',
  },
  {
    arabic: 'وَمَا أُوتِيتُم مِّن شَيْءٍ فَمَتَاعُ الْحَيَاةِ الدُّنْيَا وَزِينَتُهَا ۚ وَمَا عِندَ اللَّهِ خَيْرٌ وَأَبْقَىٰ',
    translation: 'And whatever you have been given is but the enjoyment of worldly life and its adornment. And what is with Allah is better and more lasting.',
    reference: 'Quran 28:60',
  },
];

export function getDailyDua() {
  return pickByDay(DUAS);
}

export function getDailyAyah() {
  return pickByDay(AYAHS);
}
