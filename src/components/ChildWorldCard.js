import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../utils/supabase';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://tarbiyah-production.up.railway.app';
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export function getAgeGroup(age) {
  if (!age || age <= 5) return '3-5';
  if (age <= 8) return '6-8';
  if (age <= 11) return '9-11';
  if (age <= 14) return '12-14';
  return '15+';
}

const WORLD_SNAPSHOTS = {
  '3-5': {
    ageLabel: 'Ages 3–5',
    onlineWorld: [
      { platform: 'YouTube Kids', context: 'Bright colours, repetitive characters, and catchy songs dominate. The algorithm learns fast — even kids this age get stuck in loops of similar content.', tip: 'Watch a few videos with them. The characters they love become real relationship figures in their mind.' },
      { platform: 'Cocomelon / Ms Rachel', context: 'Some of the most-watched content on earth for this age. Designed to be engaging to young brains — highly effective, hard to stop.', tip: 'Use it as a wind-down, not a default. The contrast between screen and real life is important at this age.' },
    ],
    slang: [
      { word: 'No no no', meaning: 'Refusing something — firm boundary-setting is developing', note: 'Healthy, not defiance' },
      { word: 'Mine!', meaning: 'Ownership and identity are forming — sharing feels like loss', note: 'Developmentally normal at 3–4' },
    ],
    humor: {
      summary: 'Silly, physical, and repetitive. If something made them laugh once, it will make them laugh 40 more times.',
      items: [
        { type: 'Slapstick', detail: 'Falling over, funny faces, surprise — this is the foundation of all humour. They are learning cause-and-effect through laughter.' },
        { type: 'Potty humour', detail: 'Words like "bum" and "poo" are hilarious. It is about crossing a social rule — a first taste of edgy humour. Normal and harmless.' },
        { type: 'Repetition as humour', detail: 'The same joke said five times is funnier each time. Their brains are practicing pattern recognition.' },
      ],
      islamicAngle: 'The Prophet ﷺ played with children and made them laugh. Silliness with your child is sunnah.',
    },
    concerns: [
      { concern: 'Screen time creep', detail: 'What starts as 20 minutes becomes 2 hours without a clear boundary. Kids this age cannot self-regulate.', action: 'Set a physical cue — when the show ends, the screen goes away. Consistency matters more than the rule.' },
      { concern: 'Stranger voices as trusted figures', detail: 'Kids form emotional attachments to characters and presenters they see daily — even more than distant relatives.', action: 'Engage with the content so you are part of the experience, not excluded from it.' },
    ],
    habits: [
      { habit: 'Imitation as learning', detail: 'Everything they watch gets replayed in their behaviour. If a character is rude for laughs, expect to see it at home.' },
      { habit: 'Screen as emotion regulation', detail: 'Parents increasingly use screens to calm upset children. It works short-term and creates long-term dependency.' },
    ],
    schoolCulture: [
      { trend: 'Character identity', detail: 'Who their favourite character is becomes part of their identity. "I am Bluey" is a real statement of self.' },
      { trend: 'Play as social language', detail: 'Children this age socialise through parallel play and imagination. Screen characters become play characters.' },
    ],
    starters: [
      { question: 'Who is your favourite character and why do you like them?', why: 'Reveals their values through their preferences — a window into what they admire.' },
      { question: 'If you could be any animal, what would you be?', why: 'Imagination at this age is rich and telling — opens conversations about identity.' },
      { question: 'What is the funniest thing that happened today?', why: 'Builds the habit of sharing their day — establishes you as a safe listener early.' },
    ],
    islamicLens: 'This age is the window of wonder — children are born with fitrah, a natural inclination toward beauty, truth, and the divine. What they see and hear is shaping their inner world before they have language for it. The Prophet ﷺ said every child is born on fitrah. This is the age to protect and nourish it through presence, not just content control.',
  },

  '6-8': {
    ageLabel: 'Ages 6–8',
    onlineWorld: [
      { platform: 'Roblox', context: "The gateway platform for this age group. It's a social world, not just a game — kids make friends, join communities, and develop online identity here.", tip: 'Ask them to show you their favourite game on it. Showing interest opens more doors than monitoring.' },
      { platform: 'YouTube', context: "Gaming creators (like Let's Play channels) are the main draw. Kids this age form parasocial bonds with creators — they feel like friends.", tip: 'Know the creators they watch. A 10-minute watch-together gives you enormous insight.' },
      { platform: 'Minecraft', context: "Creative, collaborative, and deeply engaging. Kids build worlds and share them — it's their first experience of digital creation.", tip: "Ask to see what they've built. It's genuinely impressive and they want to show you." },
    ],
    slang: [
      { word: 'Skibidi', meaning: 'Comes from "Skibidi Toilet" — means something chaotic, random, or silly', note: 'Harmless absurdist humour, very common' },
      { word: 'Sus', meaning: 'Suspicious — from Among Us, now general slang', note: 'Entered mainstream, no concern' },
      { word: 'POV', meaning: 'Point of view — they may act out scenarios saying "POV: you are..."', note: 'Creative roleplay language' },
      { word: 'No cap', meaning: "I'm being serious, not lying", note: 'Widely used, harmless' },
    ],
    humor: {
      summary: 'Absurdist and random. The joke is that there is no joke. Chaos equals comedy at this age.',
      items: [
        { type: 'Skibidi / brain rot', detail: '"Skibidi Toilet" and similar absurdist content is the defining humour of this generation\'s 6–8 year olds. It is random, nonsensical, and deeply funny to them. Parents often find it baffling — that is part of the appeal.' },
        { type: 'Meme imitation', detail: "Kids this age start repeating meme formats from YouTube without fully understanding them. It's how they participate in online culture." },
        { type: 'Gaming fails', detail: 'Watching someone fail at a game — repeatedly — is peak comedy. Reaction content (someone being shocked or scared) is endlessly watchable.' },
      ],
      islamicAngle: "Absurdist humour is not a sign of a shallow mind — it's a stage of cognitive development where children test the limits of logic. Engage with the silliness. A parent who laughs with their child is a parent they will talk to.",
    },
    concerns: [
      { concern: 'Stranger contact in Roblox', detail: 'Roblox allows messaging and voice chat. Some servers attract older teens. Kids this age do not always know who they are talking to.', action: 'Turn off direct messaging in Roblox settings. Play together in the same room occasionally.' },
      { concern: 'Parasocial creator bonds', detail: 'Kids feel genuine friendship with YouTubers they watch daily. When a creator behaves badly or disappears, it causes real emotional pain.', action: 'Know who they watch. Occasionally watch together. Be curious, not dismissive.' },
      { concern: 'Buying pressure in games', detail: 'Robux (Roblox currency), Minecraft skins — microtransaction culture begins here. Kids are marketed to constantly.', action: 'Talk about what things cost in real money. This is an early financial literacy conversation.' },
    ],
    habits: [
      { habit: 'Screen as social life', detail: 'For many kids this age, their real friendships happen partly online — in Roblox, Minecraft, or through gaming. Restricting screens without replacement isolates them.' },
      { habit: 'YouTube as background noise', detail: 'Kids this age often have YouTube on while doing other things — eating, playing. It becomes ambient culture, shaping language and behaviour quietly.' },
    ],
    schoolCulture: [
      { trend: 'Gaming as social currency', detail: 'What games you play determines your social standing. Not playing Roblox or Minecraft can feel genuinely isolating.' },
      { trend: 'Playground meme culture', detail: "Memes and phrases from YouTube get repeated in playgrounds. Kids who know the references are \"in\" — those who don't feel left out." },
      { trend: 'First taste of cool/uncool', detail: 'Social hierarchies start forming. Who sits where, who is invited to what — it begins here and matters more than adults realise.' },
    ],
    starters: [
      { question: "Can you show me your favourite game? I want to see what you've built.", why: "Entering their world signals curiosity, not suspicion — one of the most connecting things a parent can do." },
      { question: 'Who do you watch on YouTube? What do you like about them?', why: 'Reveals who their para-social role models are. Low-stakes entry to a big topic.' },
      { question: 'Is there anyone at school who is really funny? What makes them funny?', why: 'Opens the conversation about humour, social dynamics, and belonging.' },
    ],
    islamicLens: 'This is the age the Prophet ﷺ described the beginning of the age of discernment — children start understanding right and wrong. The digital world they are entering is vast and largely unmonitored. Fluency beats fear: a parent who knows what Roblox is, who their favourite creator is, and what "skibidi" means is a parent who remains relevant. And relevance is the foundation of influence.',
  },

  '9-11': {
    ageLabel: 'Ages 9–11',
    onlineWorld: [
      { platform: 'YouTube Shorts', context: 'The algorithm is extraordinarily powerful at this age. Short-form content trains the brain for rapid stimulation. Kids go from funny clips to emotionally heavy content within minutes without choosing to.', tip: 'Watch their Shorts feed for 5 minutes this week. You will see exactly what the algorithm thinks they want.' },
      { platform: 'Roblox (social evolution)', context: 'By 9–11, Roblox becomes less about games and more about social spaces. Roleplay servers with relationship and identity themes are popular. Older teen culture leaks in.', tip: 'Ask which servers they spend the most time on. The answer tells you a lot.' },
      { platform: 'TikTok (entering)', context: "Many kids this age are on TikTok despite age restrictions. The content is more mature — appearance, relationships, drama. Even watching without posting has impact.", tip: "Check if they have it. Have a conversation about what they've seen — without confiscating the device." },
    ],
    slang: [
      { word: 'Rizz', meaning: 'Charm or attractiveness — ability to attract someone', note: 'Originally teen slang, now at primary school level' },
      { word: 'No cap', meaning: "I'm being completely serious", note: 'Harmless, widely used' },
      { word: 'Lowkey', meaning: 'Kind of / quietly / secretly', note: 'Safe, nuanced word — shows developing emotional vocabulary' },
      { word: "It's giving", meaning: 'It has a certain energy or vibe', note: 'Creative, expressive — harmless' },
      { word: 'Cooked', meaning: 'Done, finished, in trouble', note: 'Self-deprecating — usually harmless at this age' },
    ],
    humor: {
      summary: 'Meme fluency, irony entering, self-deprecating humour, and reaction content. Humour is becoming a social identity marker.',
      items: [
        { type: '"Brain rot" content', detail: "NPC memes, Ohio memes, absurdist edits — this is the dominant humour of 9–11. Parents think it's mindless. It's actually a shared cultural dialect. Knowing what it is puts you in the conversation." },
        { type: 'Irony appearing', detail: 'Kids this age start using sarcasm and irony. They say the opposite of what they mean for comic effect. Parents often take it literally and overreact — which makes the child feel misunderstood.' },
        { type: 'Reaction content', detail: 'Watching someone react to something is endlessly entertaining. The reactor becomes a para-social companion — someone they feel they know.' },
        { type: 'Self-deprecating humour', detail: '"I\'m so cooked" / "I\'m done" — sounds alarming to parents, means nothing serious. It\'s how kids this age express mild frustration without vulnerability.' },
      ],
      islamicAngle: "The Prophet ﷺ never made anyone feel small with his humour. As irony and sarcasm enter your child's world, it is worth talking about the difference between humour that connects and humour that wounds — not as a rule, but as a value.",
    },
    concerns: [
      { concern: '"Rizz" culture entering primary schools', detail: 'Romantic attractiveness is becoming a social currency at an age where children are not emotionally ready for it. Kids who are seen as having "rizz" gain status; those who don\'t feel lacking.', action: 'No need to alarm. Worth knowing. If it comes up, use it to talk about what actually makes a person worth admiring.' },
      { concern: 'Group chat exclusion', detail: "WhatsApp and iMessage group chats are increasingly common. Being removed from a group or excluded causes genuine social pain — and happens invisibly to parents.", action: "Ask casually if their friends have group chats. You don't need access — just awareness and an open door." },
      { concern: 'YouTube algorithm rabbit holes', detail: "From gaming content to increasingly mature commentary, the algorithm will take them somewhere parents wouldn't choose. It happens gradually.", action: 'Sit with them while they watch occasionally. The algorithm shows you who the platform thinks your child is.' },
    ],
    habits: [
      { habit: 'Screens after bedtime', detail: 'Most children 9–11 watch content after lights out on a device. Parents are often unaware. Sleep deprivation affects mood, focus, and emotional regulation more than almost anything else.' },
      { habit: 'Creator as mentor', detail: 'YouTubers and gaming creators are filling a mentor role — offering life commentary, opinions, and humour daily. The creators they consume shape their worldview quietly and consistently.' },
      { habit: 'Social comparison starting', detail: '"My life is boring" starts here. The seed of inadequacy is planted through other people\'s highlights — even without Instagram.' },
    ],
    schoolCulture: [
      { trend: 'Popularity hierarchies solidifying', detail: 'Social groups are defined by 9–11. Who sits where, who is invited, who is "in" — these dynamics cause real emotional weight and are often invisible at home.' },
      { trend: 'Prank culture', detail: 'YouTube prank content gets imitated in schools. Kids test boundaries by doing to classmates what they see creators do. It rarely lands the same way.' },
      { trend: 'Appearance starting to matter', detail: 'Clothing brands, hair, how you look — this starts becoming relevant. Children who have not cared suddenly care deeply. This is normal and worth being ready for.' },
    ],
    starters: [
      { question: "What is the funniest thing you've seen online this week?", why: "Low-stakes entry to their digital world. Reveals what they're consuming without interrogation." },
      { question: 'Is there anyone at school who is really popular? What makes them popular?', why: 'Opens the conversation about values, social dynamics, and what your child actually admires.' },
      { question: 'If you could show me one thing you love online, what would it be?', why: 'Signals you are curious about their world — one of the most connecting invitations you can offer.' },
    ],
    islamicLens: 'At 9–11, children are approaching the age of accountability in Islamic tradition. They are beginning to form their own identity — and the digital world is offering them one. Your role is not to compete with the screen but to be a more compelling presence. A parent who knows what "brain rot" is, who watches a YouTube Short with their child, and who asks real questions is a parent who remains someone worth talking to. The Prophet ﷺ walked alongside young people. Walk alongside yours.',
  },

  '12-14': {
    ageLabel: 'Ages 12–14',
    onlineWorld: [
      { platform: 'TikTok', context: 'The defining platform of this generation. The algorithm is extraordinarily accurate at surfacing content that matches mood and interest — including content on appearance, relationships, and identity that you would not choose for them.', tip: 'Ask them to show you their For You page. It is a portrait of what the algorithm thinks they are.' },
      { platform: 'Snapchat', context: 'Designed to disappear. The architecture encourages private, unmonitored communication. Streaks create social obligation — missing one feels like a betrayal.', tip: 'Know they likely have it. Ask about streaks — it opens a conversation about the pressure in their social life.' },
      { platform: 'Discord', context: 'Server-based communities, often around games or interests. Can be excellent — and can expose kids to older communities, adult content, and anonymous interaction.', tip: 'Ask which servers they are in. The server name tells you a lot. Curiosity, not surveillance.' },
      { platform: 'YouTube / Shorts', context: 'Shorts algorithm becomes more sophisticated and more targeted. Commentary channels, opinion creators, and ideological content enter the feed alongside entertainment.', tip: 'Watch what they find funny. Humour is ideology at this age — it reveals the worldview being formed.' },
    ],
    slang: [
      { word: 'Mid', meaning: 'Average, mediocre, nothing special', note: 'Often used to dismiss things — including things parents suggest' },
      { word: 'Slay', meaning: 'Doing something exceptionally well', note: 'Positive, empowering — harmless' },
      { word: 'Understood the assignment', meaning: 'Did exactly the right thing, nailed it', note: 'Positive and creative expression' },
      { word: "I'm dead", meaning: 'That was so funny I cannot function', note: 'Hyperbole — not literal' },
      { word: 'NPC', meaning: 'Non-player character — someone who acts robotically or without original thought', note: 'Watch for this being used about you or school' },
      { word: 'Rent free', meaning: "Something is living in your head — you can't stop thinking about it", note: 'Emotionally aware expression, actually' },
    ],
    humor: {
      summary: 'Irony, dark humour, absurdism, and insider references. Humour is now identity. Who you laugh with and what you find funny signals which group you belong to.',
      items: [
        { type: 'Dark humour', detail: 'Jokes about death, failure, and anxiety are common at this age. It is how teens process real fears — naming the scary thing as a joke reduces its power. Alarming to parents, usually healthy in moderation.' },
        { type: 'Irony and sarcasm', detail: 'This is the primary register now. Everything is said at one remove. Taking things literally is "cringe" — the worst possible social sin. If you always take their sarcasm seriously, they stop talking.' },
        { type: '"NPC" and absurdist content', detail: "People acting as non-player characters, robots, or emotionless automatons. It's a comment on conformity — and often a surprisingly sharp piece of social criticism." },
        { type: 'Self-deprecation as bonding', detail: '"I\'m literally the worst" said to get laughs. At 12–14 this is social bonding. At 15+ it becomes worth paying more attention to.' },
      ],
      islamicAngle: 'Dark humour is how this generation holds difficult emotions at arm\'s length. It is worth knowing the difference between healthy processing and a signal that something is genuinely wrong. The Prophet ﷺ never dismissed the concerns of young people. Ask what is actually funny about the jokes they love.',
    },
    concerns: [
      { concern: 'Appearance pressure', detail: 'TikTok beauty standards are extraordinarily specific and almost universally unattainable. Boys and girls both face this differently but equally. The comparison is constant and invisible.', action: 'Build the vocabulary for it before they need it. "You know the people comparing themselves to someone else." Plant the idea.' },
      { concern: 'Group chat dynamics', detail: 'Entire social lives play out in group chats. Exclusion from a chat, being screenshot, having things said about you — these are real social traumas that parents rarely see.', action: 'Ask about their group chats — not who is in them, but how they feel about them. There is usually something to uncover.' },
      { concern: 'Online ideological content', detail: 'Algorithm-driven opinion content reaches 12–14 year olds regularly. Masculinity channels, political commentary, identity content — all targeting teens seeking a worldview.', action: 'Know what they watch outside of entertainment. Ask about their opinions on things. Curiosity keeps the door open.' },
      { concern: 'Streaks and social obligation', detail: 'Snapchat streaks, daily check-ins, group commitments — teens feel genuine social anxiety about breaking these. It manufactures obligation that did not exist before.', action: 'If they seem stressed about their phone at certain times, streaks might be why. Worth a gentle ask.' },
    ],
    habits: [
      { habit: 'Phone as the first and last thing', detail: 'Most teens check their phone within 5 minutes of waking and within 5 minutes of sleeping. Their mood is set by what they see before they have had a single real-world experience.' },
      { habit: 'Identity performance online', detail: 'Even without posting, teens curate how they are perceived — which group chats they are in, which memes they share, what they react to. Their online presence is identity work.' },
      { habit: 'Para-social mentors replacing real ones', detail: 'Opinion creators, commentary channels, and influencers are providing the worldview, values, and life advice that previous generations got from community, family, and religion.' },
    ],
    schoolCulture: [
      { trend: 'Reputation as currency', detail: 'How you are perceived matters more than almost anything at 12–14. One viral moment — good or bad — in a school group chat can define a social experience for months.' },
      { trend: 'Ironic detachment as social armour', detail: '"I don\'t care about anything" is the dominant social posture. Caring too much about school, trying too hard, showing genuine enthusiasm — all social risks. This makes academic engagement harder.' },
      { trend: 'Masculinity / femininity pressures', detail: 'Online content about what boys and girls "should" be is reaching this age group hard. Boys encounter hyper-masculinity content; girls encounter hyper-femininity beauty standards. Both are damaging.' },
    ],
    starters: [
      { question: "What is something you find genuinely funny that you think I wouldn't get?", why: 'Disarms the usual dynamic. Invites them to educate you rather than be questioned by you.' },
      { question: 'Is there anything you see online that bothers you even a little?', why: 'Rare that a teen says nothing. Opens the door to concerns they may not have shared.' },
      { question: 'What do you think makes someone actually confident — not just performing confidence?', why: 'Speaks directly to the appearance pressure and social performance of this age without naming it.' },
    ],
    islamicLens: 'At 12–14, identity is the central project. The question "who am I?" is being answered — and the internet is answering it loudly. Islamic identity is not a restriction on this search; it is an anchor within it. The young people who fare best at this age have a strong sense of who they are and why. Your conversations now — not the rules, but the conversations — are what will shape that. The Prophet ﷺ gave deep attention and counsel to young companions at this age. Your teenager is not too old for yours.',
  },

  '15+': {
    ageLabel: 'Ages 15–18',
    onlineWorld: [
      { platform: 'TikTok / Instagram Reels', context: 'At 15+, the algorithm serves increasingly mature content — relationships, sexuality, ideology, politics. The personalisation is precise. Two teens can have completely different experiences of the same platform.', tip: 'Ask them what their feed looks like. Not to monitor — to understand who the platform thinks they are.' },
      { platform: 'Discord', context: 'Deep community participation — servers for interests, gaming, ideology, and more. Some of the most formative intellectual and social development of this age happens here, away from parental awareness.', tip: 'Know what communities they are part of. Ask what they talk about. Be genuinely curious.' },
      { platform: 'YouTube (long-form commentary)', context: 'Long-form opinion content — political, philosophical, lifestyle. Teens at 15+ are building a worldview, and YouTube creators are primary contributors to it.', tip: 'Ask them to share a video they found interesting lately. Watch it. Then talk about it.' },
      { platform: 'Reddit', context: "Anonymous, community-driven, and deeply influential. Teens use it for advice, community, and opinion — often on topics they wouldn't raise with parents.", tip: 'Know they likely use it. Ask generally about online communities rather than Reddit specifically.' },
    ],
    slang: [
      { word: 'Based', meaning: "Authentic, confident in one's opinions regardless of what others think", note: 'Can be positive or used in ideological online spaces — context matters' },
      { word: 'Ick', meaning: 'A sudden feeling of repulsion toward someone', note: 'Comes from dating culture — worth knowing' },
      { word: 'Situationship', meaning: "A romantic connection that isn't defined as a relationship", note: 'Widely discussed in this age group — often a source of real emotional confusion' },
      { word: 'Main character', meaning: 'Feeling like the protagonist of your own life', note: 'Can be positive self-regard or dissociation from reality' },
      { word: 'Delulu', meaning: 'Delusional — used affectionately for unrealistic hope', note: 'Usually self-applied, humorous' },
      { word: 'Gaslit', meaning: 'Having your perception of reality manipulated', note: 'Genuine psychological vocabulary — shows awareness, worth encouraging' },
    ],
    humor: {
      summary: 'Nihilistic, meta-ironic, and often indistinguishable from genuine distress. This is the age where you need to know the difference.',
      items: [
        { type: 'Nihilistic humour', detail: '"Nothing matters" and "we\'re all going to die anyway" said for laughs. Usually genuine dark comedy processing existential anxiety — a healthy cognitive move. Sometimes a signal. Know the difference by paying attention to context and patterns.' },
        { type: 'Meta-irony', detail: 'So many layers of irony that sincerity becomes almost impossible to express. Everything is a bit. Genuine emotion gets wrapped in enough distance that it becomes unrecognisable — even to the person feeling it.' },
        { type: 'Doomer aesthetics', detail: 'Content that leans into pessimism, decline, and hopelessness — framed as realistic rather than cynical. "Doomer" content is a real genre. Watch for it becoming a primary lens on life.' },
        { type: 'Self-aware cringe', detail: "Deliberately doing cringe things ironically. The joke is that they know it's embarrassing. A sophisticated form of social performance." },
      ],
      islamicAngle: 'Nihilistic humour is often a young person standing at the edge of meaninglessness and laughing because the alternative is too heavy. Islam offers the most powerful counter-narrative available: life has profound meaning, you have a specific purpose, and you are not alone. This is not a lecture — it is a conversation. The most important thing you can do is stay in dialogue.',
    },
    concerns: [
      { concern: 'Dating culture and "situationships"', detail: 'Teens are navigating relationships in a culture that valorises ambiguity and non-commitment. The emotional confusion this creates is real and largely processed without adult guidance.', action: "If you haven't talked about relationships from an Islamic perspective, this is the time. Not rules — values. What does Islam say about dignity, commitment, and love?" },
      { concern: 'Online ideological communities', detail: 'Masculinity movements, political extremism, nihilism — teens searching for identity and meaning are targets for ideological recruitment online. It happens gradually and through humour first.', action: 'The antidote is a stronger narrative, not restriction. A teen with a clear Islamic identity and a parent who engages seriously with their questions is far more resistant.' },
      { concern: 'Comparison and self-worth', detail: "The gap between a curated online life and real life is at its most damaging at 15+. Mental health impacts of social media are well-documented at this age, particularly for girls.", action: 'Name the game. "Everyone is performing for everyone else. Including the people who look like they\'re not." Make it a conversation, not a warning.' },
      { concern: 'Anxiety and mental health content', detail: 'Mental health content on TikTok is a double-edged sword — it normalises seeking help but also leads to self-diagnosis and sometimes identity-formation around struggle.', action: 'Take their emotional language seriously. If they use therapeutic vocabulary, meet them there — then go deeper.' },
    ],
    habits: [
      { habit: 'Chronic low-level distraction', detail: 'Always half-present — phone in hand, content playing, notifications arriving. Deep attention becomes genuinely difficult. This affects learning, relationships, and self-knowledge.' },
      { habit: 'Online processing before real-world processing', detail: 'Teens increasingly process difficult emotions by seeking content or community online before turning to family or real friends. You may hear about something weeks after it happened.' },
      { habit: 'Identity performance replacing identity formation', detail: 'Curating a persona online can substitute for the harder work of knowing who you actually are. The performance becomes the self.' },
    ],
    schoolCulture: [
      { trend: 'Academic pressure and "burnout" language', detail: 'Teens at 15+ are experiencing and naming burnout in increasing numbers. The word itself is now part of youth culture — sometimes genuine, sometimes a frame for avoidance. Worth taking seriously either way.' },
      { trend: 'Political and social identity', detail: 'School becomes a space where political and social identity is performed and tested. Teens are choosing sides on issues and building community around those positions.' },
      { trend: 'Future anxiety', detail: 'Genuine anxiety about careers, university, climate, and the future is common and real. It often presents as nihilism but underneath is fear. "Nothing matters" sometimes means "I don\'t know how to navigate what matters."' },
    ],
    starters: [
      { question: "What is something you've seen online recently that actually made you think?", why: 'Respects their intellectual development. Invites serious conversation without interrogation.' },
      { question: "What do you think your generation understands about the world that older generations don't?", why: 'Positions you as a learner. Teens open up when they feel their perspective is genuinely valued.' },
      { question: 'If you could change one thing about how you spend your time, what would it be?', why: 'Opens self-reflection about habits and purpose — the central developmental work of this age.' },
    ],
    islamicLens: 'At 15–18, your teenager is building the foundation they will stand on for the rest of their life. The questions they are wrestling with — who am I, does anything matter, what am I for — are the deepest questions a human can ask. Islam has answers. But the answers only land if the relationship is strong enough to hold them. This is the age to be less of a rule-enforcer and more of a companion in the search. The young Companions of the Prophet ﷺ were given real responsibility and deep engagement at this age. Your teenager is ready for the same.',
  },
};

const SECTION_CONFIG = [
  { key: 'onlineWorld',   emoji: '📱', label: 'What They May Be Seeing Online' },
  { key: 'slang',         emoji: '💬', label: 'Slang This Week'                },
  { key: 'humor',         emoji: '😂', label: 'What Kids Are Laughing At'      },
  { key: 'concerns',      emoji: '⚠️', label: 'Online Concerns'               },
  { key: 'habits',        emoji: '🔄', label: 'Youth Habits'                   },
  { key: 'schoolCulture', emoji: '🏫', label: 'School Culture'                 },
  { key: 'starters',      emoji: '🗣️', label: 'Ask This Week'                 },
  { key: 'islamicLens',   emoji: '🌙', label: 'Islamic Lens'                   },
];

function WorldSection({ sectionKey, data }) {
  const [open, setOpen] = useState(false);
  const cfg = SECTION_CONFIG.find(s => s.key === sectionKey);
  if (!cfg || !data) return null;

  function renderContent() {
    if (sectionKey === 'onlineWorld') {
      return data.map((item, i) => (
        <View key={i} style={cw.sectionItem}>
          <Text style={cw.itemTitle}>{item.platform}</Text>
          <Text style={cw.itemBody}>{item.context}</Text>
          <View style={cw.tipRow}>
            <Ionicons name="bulb-outline" size={13} color="#2E7D62" />
            <Text style={cw.tipText}>{item.tip}</Text>
          </View>
          {i < data.length - 1 && <View style={cw.itemDivider} />}
        </View>
      ));
    }
    if (sectionKey === 'slang') {
      return data.map((item, i) => (
        <View key={i} style={cw.slangRow}>
          <View style={cw.slangWord}><Text style={cw.slangWordText}>"{item.word}"</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={cw.slangMeaning}>{item.meaning}</Text>
            <Text style={cw.slangNote}>{item.note}</Text>
          </View>
        </View>
      ));
    }
    if (sectionKey === 'humor') {
      return (
        <View>
          <Text style={cw.itemBody}>{data.summary}</Text>
          <View style={{ height: 12 }} />
          {data.items.map((item, i) => (
            <View key={i} style={cw.sectionItem}>
              <Text style={cw.itemTitle}>{item.type}</Text>
              <Text style={cw.itemBody}>{item.detail}</Text>
              {i < data.items.length - 1 && <View style={cw.itemDivider} />}
            </View>
          ))}
          <View style={cw.islamicPill}>
            <Text style={cw.islamicPillText}>{data.islamicAngle}</Text>
          </View>
        </View>
      );
    }
    if (sectionKey === 'concerns') {
      return data.map((item, i) => (
        <View key={i} style={cw.sectionItem}>
          <Text style={cw.itemTitle}>{item.concern}</Text>
          <Text style={cw.itemBody}>{item.detail}</Text>
          <View style={cw.tipRow}>
            <Ionicons name="checkmark-circle-outline" size={13} color="#2E7D62" />
            <Text style={cw.tipText}>{item.action}</Text>
          </View>
          {i < data.length - 1 && <View style={cw.itemDivider} />}
        </View>
      ));
    }
    if (sectionKey === 'habits' || sectionKey === 'schoolCulture') {
      const items = sectionKey === 'habits'
        ? data.map(d => ({ title: d.habit, body: d.detail }))
        : data.map(d => ({ title: d.trend, body: d.detail }));
      return items.map((item, i) => (
        <View key={i} style={cw.sectionItem}>
          <Text style={cw.itemTitle}>{item.title}</Text>
          <Text style={cw.itemBody}>{item.body}</Text>
          {i < items.length - 1 && <View style={cw.itemDivider} />}
        </View>
      ));
    }
    if (sectionKey === 'starters') {
      return data.map((item, i) => (
        <View key={i} style={cw.starterCard}>
          <Text style={cw.starterQ}>"{item.question}"</Text>
          <Text style={cw.starterWhy}>{item.why}</Text>
        </View>
      ));
    }
    if (sectionKey === 'islamicLens') {
      return <Text style={cw.islamicBody}>{data}</Text>;
    }
    return null;
  }

  return (
    <View style={cw.section}>
      <TouchableOpacity style={cw.sectionHeader} onPress={() => setOpen(o => !o)} activeOpacity={0.7}>
        <View style={cw.sectionEmojiWrap}>
          <Text style={cw.sectionEmoji}>{cfg.emoji}</Text>
        </View>
        <Text style={cw.sectionHeaderText}>{cfg.label}</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color="#2E7D62" />
      </TouchableOpacity>
      {open && <View style={cw.sectionBody}>{renderContent()}</View>}
    </View>
  );
}

export function ChildWorldCard({ child }) {
  const ageGroup    = getAgeGroup(child?.age);
  const displayName = child?.name?.split(' ')[0] ?? 'Your Child';
  const cacheKey    = `tarbiyah_world_${child?.id ?? 'default'}`;

  const [snap,    setSnap]    = useState(WORLD_SNAPSHOTS[ageGroup]);
  const [loading, setLoading] = useState(false);
  const [live,    setLive]    = useState(false);

  useEffect(() => {
    if (!child?.id) return;
    let cancelled = false;

    async function load() {
      // Check cache first
      try {
        const raw = await AsyncStorage.getItem(cacheKey);
        if (raw) {
          const cached = JSON.parse(raw);
          const age    = Date.now() - new Date(cached.generatedAt).getTime();
          if (age < CACHE_TTL_MS) {
            if (!cancelled) { setSnap(cached); setLive(true); }
            return;
          }
        }
      } catch {}

      // Fetch from backend
      setLoading(true);
      try {
        const { data: session } = await supabase.auth.getSession();
        const token = session?.session?.access_token;
        if (!token) return;

        const params = new URLSearchParams({
          age:       String(child.age ?? 10),
          ...(child.gender    ? { gender:    child.gender }                       : {}),
          ...(child.name      ? { name:      child.name.split(' ')[0] }           : {}),
          ...(child.interests?.length ? { interests: child.interests.join(',') } : {}),
        });

        const res = await fetch(`${API_URL}/child-world?${params}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const data = await res.json();

        if (!cancelled && data?.onlineWorld) {
          await AsyncStorage.setItem(cacheKey, JSON.stringify(data));
          setSnap(data);
          setLive(true);
        }
      } catch (e) {
        console.warn('[ChildWorldCard] fetch error:', e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [child?.id]);

  return (
    <View style={cw.card}>
      {/* Header — matches phase card structure */}
      <View style={cw.topRow}>
        <View style={cw.emojiWrap}>
          <Text style={cw.emojiMain}>🌍</Text>
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={cw.eyebrow}>THIS WEEK IN YOUTH CULTURE</Text>
            {loading && <ActivityIndicator size="small" color="#2E7D62" style={{ marginBottom: 2 }} />}
            {live && !loading && (
              <View style={cw.liveBadge}><Text style={cw.liveBadgeText}>LIVE</Text></View>
            )}
          </View>
          <Text style={cw.title}>This Week in {displayName}'s World</Text>
          <View style={cw.ageBadge}><Text style={cw.ageBadgeText}>{snap.ageLabel}</Text></View>
        </View>
      </View>

      {/* Divider */}
      <View style={cw.divider} />

      {/* Sections */}
      {['onlineWorld', 'slang', 'humor', 'concerns', 'habits', 'schoolCulture', 'starters', 'islamicLens'].map(key => (
        <WorldSection key={key} sectionKey={key} data={snap[key]} />
      ))}
    </View>
  );
}

const CARD_SHADOW = {
  shadowColor: '#000000',
  shadowOffset: { width: 0, height: 3 },
  shadowOpacity: 0.10,
  shadowRadius: 14,
  elevation: 5,
};

const cw = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF', borderRadius: 18,
    padding: 16, marginBottom: 4,
    ...CARD_SHADOW,
  },

  // Header — mirrors phaseTopRow + phaseEmojiWrap + phaseEyebrow + phaseTitle
  topRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 14 },
  emojiWrap: {
    width: 42, height: 42, borderRadius: 12,
    backgroundColor: '#EDF7F2', alignItems: 'center', justifyContent: 'center',
  },
  emojiMain:  { fontSize: 20 },
  eyebrow: { fontSize: 10, fontWeight: '700', color: '#2E7D62', letterSpacing: 1, marginBottom: 2 },
  title:   { fontSize: 15, fontWeight: '800', color: '#1A1A2E', marginBottom: 6 },
  ageBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#EDF7F2', borderRadius: 100, paddingHorizontal: 10, paddingVertical: 3,
  },
  ageBadgeText: { fontSize: 11, fontWeight: '700', color: '#2E7D62' },
  liveBadge: {
    backgroundColor: '#2E7D62', borderRadius: 100, paddingHorizontal: 7, paddingVertical: 2,
  },
  liveBadgeText: { fontSize: 9, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.8 },

  divider: { height: 1, backgroundColor: '#EDF7F2', marginBottom: 4 },

  // Sections — mirrors phase card growth area rows
  section: { borderBottomWidth: 1, borderBottomColor: '#EDF7F2' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  sectionEmojiWrap: {
    width: 32, height: 32, borderRadius: 8,
    backgroundColor: '#EDF7F2', alignItems: 'center', justifyContent: 'center',
  },
  sectionEmoji: { fontSize: 16 },
  sectionHeaderText: { flex: 1, fontSize: 14, fontWeight: '700', color: '#1A1A2E' },
  sectionBody: { paddingBottom: 14 },

  sectionItem: { paddingTop: 4 },
  itemTitle: { fontSize: 13, fontWeight: '700', color: '#1A1A2E', marginBottom: 4 },
  itemBody:  { fontSize: 13, color: '#374151', lineHeight: 20 },
  itemDivider: { height: 1, backgroundColor: '#EDF7F2', marginVertical: 12 },

  tipRow: {
    flexDirection: 'row', gap: 6, alignItems: 'flex-start',
    marginTop: 8, backgroundColor: '#EDF7F2', borderRadius: 8, padding: 10,
  },
  tipText: { flex: 1, fontSize: 12, color: '#1B4D3E', lineHeight: 18, fontWeight: '500' },

  slangRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 10 },
  slangWord: {
    backgroundColor: '#EDF7F2', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 5, minWidth: 80,
  },
  slangWordText: { fontSize: 13, fontWeight: '700', color: '#1B4D3E' },
  slangMeaning: { fontSize: 13, color: '#374151', fontWeight: '500', marginBottom: 2 },
  slangNote:    { fontSize: 11, color: '#9CA3AF' },

  islamicPill: {
    backgroundColor: '#EDF7F2', borderRadius: 10, padding: 12, marginTop: 12,
    borderLeftWidth: 3, borderLeftColor: '#2E7D62',
  },
  islamicPillText: { fontSize: 12, color: '#1B4D3E', lineHeight: 19, fontStyle: 'italic' },
  islamicBody: { fontSize: 13, color: '#374151', lineHeight: 21 },

  starterCard: {
    backgroundColor: '#EDF7F2', borderRadius: 12, padding: 14, marginBottom: 8,
    borderLeftWidth: 3, borderLeftColor: '#2E7D62',
  },
  starterQ:    { fontSize: 14, fontWeight: '700', color: '#1A1A2E', lineHeight: 20, marginBottom: 6 },
  starterWhy:  { fontSize: 12, color: '#6B7280', lineHeight: 18 },
});
