export const HABIT_MESSAGES = [
  { emoji: '💚', title: 'MashaAllah!', body: 'Consistency is where the barakah lives. The Prophet ﷺ said the most beloved deeds to Allah are those done regularly, even if small.' },
  { emoji: '🌱', title: 'Alhamdulillah!', body: 'Another small step in building their character. These moments compound over years into something extraordinary.' },
  { emoji: '⭐', title: 'SubhanAllah!', body: 'You showed up for them today. That is exactly what tarbiyah looks like — showing up, again and again.' },
  { emoji: '🤲', title: 'MashaAllah!', body: 'Every habit you build today is a root that holds your child steady through the storms of tomorrow.' },
  { emoji: '🌿', title: 'Alhamdulillah!', body: 'Small acts, done consistently, change children forever. Never underestimate what you are doing.' },
  { emoji: '✨', title: 'SubhanAllah!', body: 'Barakah lives in the small, faithful moments. Your effort is seen and never lost.' },
  { emoji: '💛', title: 'MashaAllah!', body: 'The angels witness what you do for your children. Keep planting — the harvest will come.' },
  { emoji: '🌟', title: 'Alhamdulillah!', body: 'You are building a Muslim who will carry this beyond your lifetime. That is the real legacy.' },
];

export const ACTIVITY_MESSAGES = [
  { emoji: '🎉', title: 'MashaAllah!', body: 'They will remember this long after you have forgotten it. Your presence is the greatest gift you can give.' },
  { emoji: '💛', title: 'Alhamdulillah!', body: 'Time invested in your children is never wasted. Every shared moment builds a bond that carries them through life.' },
  { emoji: '🌟', title: 'SubhanAllah!', body: 'A child who feels seen grows up with roots. You just gave them that sense of belonging.' },
  { emoji: '🤲', title: 'MashaAllah!', body: 'Every activity you share together anchors their deen in joy, not just duty. This is the real tarbiyah.' },
  { emoji: '⭐', title: 'Alhamdulillah!', body: 'You made time. In a world full of distractions, that says everything about your priorities as a parent.' },
  { emoji: '🌱', title: 'SubhanAllah!', body: 'These shared moments are the stories they will carry into adulthood — and pass to their own children.' },
  { emoji: '💚', title: 'MashaAllah!', body: 'Childhood is short. You chose to be present in it. May Allah bless you and your family with more moments like this.' },
  { emoji: '✨', title: 'Alhamdulillah!', body: 'The best thing a parent can give their child is time. You gave that today.' },
];

export const GOALS_MESSAGES = [
  { emoji: '💚', title: 'MashaAllah!', body: 'You showed up for your family today. Every time you do this, you are building something that lasts.' },
  { emoji: '🤲', title: 'Alhamdulillah!', body: 'The Prophet ﷺ said: "The best of you are those who are best to their families." This is that in action.' },
  { emoji: '✨', title: 'SubhanAllah!', body: 'A family that strives together, grows together. Keep going — every effort is seen by Allah.' },
  { emoji: '🌟', title: 'MashaAllah!', body: 'Small, consistent acts like this are the foundation of a strong Muslim home. May Allah bless your family.' },
  { emoji: '💛', title: 'Alhamdulillah!', body: 'You made time for what matters most. That is not small — that is exactly what tarbiyah looks like.' },
  { emoji: '🌱', title: 'SubhanAllah!', body: 'Every goal you complete plants a seed in your family\'s deen. Keep watering it.' },
];

export function pickRandom(messages) {
  return messages[Math.floor(Math.random() * messages.length)];
}
