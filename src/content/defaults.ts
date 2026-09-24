import type { SiteContent } from './schema';

/**
 * DEFAULT PUBLIC CONTENT – the single place where MCSLI's organisational facts live in code.
 * Every value was taken from the live mcsli.org website (see docs/FINDINGS.md). Administrators
 * can override any key from /admin/content; the app merges database values over these defaults.
 *
 * Nothing in this file is invented. Where the live site and repository disagreed, the live site
 * (newer) was used and the item is flagged for MCSLI to confirm.
 */
export const defaultContent: SiteContent = {
  organisation: {
    name: 'Master Class Sign Language Initiative',
    shortName: 'MCSLI',
    slogan: 'Through Sign Language, the Hand Can Speak',
    tagline: 'Empowering the Deaf, Connecting Communities, Inspiring Change.',
    registrationNumber: '80034987295030',
    registrar: 'Uganda Registration Services Bureau (URSB)',
    foundedYear: 2023,
    registeredYear: 2024,
    type: 'Non-profit organisation',
    leadership: 'Deaf-led',
    intro:
      'We are a Deaf-led organisation in Uganda dedicated to promoting Ugandan Sign Language (USL), empowering Deaf and Hard of Hearing individuals, and creating a more inclusive society.',
    mission: 'To promote Ugandan Sign Language (USL) and empower the Deaf community through education, advocacy, and inclusive opportunities.',
    vision: 'A society where Deaf and Hard of Hearing individuals enjoy equal access, full participation, and opportunity in all aspects of life.',
    vision2040: {
      quote:
        'By 2040, MCSLI aims to eliminate communication barriers in Uganda and East Africa, ensuring that Deaf and Hard of Hearing individuals can fully participate in all sectors of society without limitations.',
      author: 'Ssenyonjo Jim Maurice',
      title: 'Founder & Executive Director',
    },
    coreValues: ['Inclusivity', 'Innovation', 'Teamwork', 'Equality', 'Integrity', 'Accessibility', 'Connection', 'Empowerment', 'Creativity', 'Impact'],
  },

  contact: {
    address: 'Plot 254, Sir Apollo Kaggwa Road, Makerere, Kampala, Uganda',
    addressShort: 'Plot 254, Sir Apollo Kaggwa Road, Makerere, Kampala',
    phone: '0701806993',
    phoneIntl: '+256701806993',
    whatsapp: '+256701806993',
    email: 'info@mcsli.org',
    website: 'www.mcsli.org',
    hours: [
      { days: 'Monday – Friday', hours: '8:00 AM – 5:00 PM' },
      { days: 'Saturday', hours: '9:00 AM – 1:00 PM' },
      { days: 'Sunday', hours: 'Closed' },
    ],
    social: {
      facebook: 'https://www.facebook.com/profile.php?id=100095357002147',
      x: 'https://x.com/mclass394?s=21',
      instagram: 'https://www.instagram.com/mclass394',
      linkedin: 'https://www.linkedin.com/in/masterclass-sign-language-initiative-063841287',
    },
    mapQuery: 'Plot+254+Sir+Apollo+Kaggwa+Road+Makerere+Kampala+Uganda',
  },

  hero: {
    eyebrow: 'Deaf-led · Kampala, Uganda',
    headline: 'Learn Sign Language.',
    headlineAccent: 'Connect Without Barriers.',
    subheadline:
      'MCSLI teaches Ugandan Sign Language to individuals, families, professionals and organisations — in person in Kampala and now online, anywhere. Through sign language, the hand can speak.',
    primaryCta: { label: 'Start Learning', to: '/online-learning' },
    secondaryCta: { label: 'Explore MCSLI', to: '/about' },
    image: '/media/gallery/outdoor-teaching-session.jpg',
    imageAlt: 'An MCSLI trainer leads an outdoor Ugandan Sign Language lesson on the lawn at Namirembe Diocese, with learners seated in a semicircle.',
  },

  // Values published on mcsli.org at the time of the redesign. The repository contained different
  // numbers (15+ districts, 500+ trained, 8 programmes). MCSLI must confirm and mark them verified.
  impact_stats: {
    asOf: '2025',
    stats: [
      { label: 'Districts reached', value: '5', verified: false, note: 'Live website value; repository showed 15+' },
      { label: 'People trained', value: '150', verified: false, note: 'Live website value; repository showed 500+' },
      { label: 'Programmes running', value: '6', verified: false, note: 'Live website value; repository showed 8' },
      { label: 'Years of impact', value: '2', verified: false, note: 'Founded 2023' },
    ],
  },

  programs: {
    intro: 'Master Class Sign Language Initiative offers comprehensive training programmes for individuals, organisations, and communities to learn Ugandan Sign Language.',
    training: [
      { slug: 'healthcare', title: 'Healthcare Professionals', description: 'Specialised sign language training for doctors, nurses, and healthcare workers to improve patient care and communication.', duration: '3 months', format: 'In-person & Online', icon: 'stethoscope' },
      { slug: 'law-enforcement', title: 'Law Enforcement & Security', description: 'Essential sign language skills for police officers, security personnel, and legal professionals.', duration: '3 months', format: 'In-person & Online', icon: 'shield' },
      { slug: 'community', title: 'Community Learning Workshops', description: 'Open workshops for community members to learn basic sign language and Deaf awareness.', duration: 'Ongoing', format: 'Community centres', icon: 'heart' },
      { slug: 'corporate', title: 'Corporate & Organisational Programmes', description: 'Customised training programmes for businesses and organisations to create inclusive workplaces.', duration: 'Flexible', format: 'On-site & Virtual', icon: 'building' },
      { slug: 'individual', title: 'Individual & Family Courses', description: 'Personal sign language courses for individuals and families with Deaf members.', duration: '3 months', format: 'Flexible', icon: 'user' },
    ],
    schedule: [
      { type: 'Online Training', days: 'Monday & Tuesday', time: '4:00 PM – 6:00 PM', format: 'Live sessions with recorded videos' },
      { type: 'Physical Training', days: 'Thursday', time: '3:40 PM – 5:30 PM', format: 'In-person at our centre' },
      { type: 'Weekend Sessions', days: 'Saturday', time: '9:30 AM – 12:30 PM', format: 'In-person intensive' },
    ],
    certificateNote:
      'Participants who complete the full three-month training programme will receive an official MCSLI Certificate issued by the Uganda National Association of the Deaf (UNAD) recognising their achievement and proficiency in Ugandan Sign Language.',
    focusAreas: [
      { title: 'Inclusive Education for Deaf Children', description: 'Providing quality education and learning opportunities for Deaf children across Uganda.', icon: 'graduation' },
      { title: 'Sign Language Training', description: 'Comprehensive training programmes for individuals and organisations to learn Ugandan Sign Language.', icon: 'hand' },
      { title: 'Advocacy for Equal Rights', description: 'Championing equal rights and opportunities for Deaf and Hard of Hearing individuals.', icon: 'megaphone' },
      { title: 'Community Awareness', description: 'Building understanding and acceptance within communities about Deaf culture and communication.', icon: 'users' },
      { title: 'Innovation and Technology', description: 'Developing technological solutions to improve accessibility and communication.', icon: 'lightbulb' },
      { title: 'Global Partnerships', description: 'Collaborating with international organisations to expand our reach and impact.', icon: 'globe' },
    ],
    empowerment: [
      { title: 'Deaf Youth Leadership Development', description: 'Leadership training designed to develop the next generation of Deaf leaders.', features: ['Leadership skills', 'Public speaking', 'Project management', 'Mentorship'] },
      { title: "Women's Vocational Training", description: 'Skills-based training to help Deaf women develop entrepreneurship and vocational skills.', features: ['Business skills', 'Technical training', 'Financial literacy', 'Networking'] },
      { title: 'Mentorship Programme', description: 'Pairing young Deaf individuals with experienced mentors for personal and professional guidance.', features: ['Career guidance', 'Personal development', 'Skill building', 'Network building'] },
    ],
  },

  // Learner testimonies published on mcsli.org, reproduced verbatim (light punctuation only).
  stories: [
    {
      slug: 'nakalanda-sandra',
      name: 'Nakalanda Sandra',
      year: '2024',
      featured: true,
      image: '/media/stories/nakalanda-sandra.jpg',
      summary:
        'After an emotional encounter in high school where she was unable to help a mother in need, Sandra dedicated herself to learning USL to restore dignity and partnership.',
      testimony: `How Sign Language Has Helped Me?

Sign language has become far more than a skill, it has reshaped my understanding of dignity, communication and community.

My journey began on an ordinary high-school afternoon when a woman stood before my classmates and me, her baby crying, her hands moving desperately in gestures we could not understand. She needed help. We could not give it. And when she walked away, I felt something inside me shift. I stood there helpless and ashamed because language had become a barrier instead of a bridge.

I made a quiet promise that day: One day, I will learn sign language.

Years later, I finally honored that promise and this year, I learnt Uganda Sign Language.

Sign language has helped me see people more clearly. Through sign language, I have come to understand that the Deaf are thinkers, leaders, innovators and dreamers. And for me, being able to communicate with them has replaced helplessness with confidence, distance with connection and ignorance with empathy.

Short Advice to the Deaf Community

Never shrink yourself to fit the limits others place on you. Your silence is not a weakness, it is a language, a culture and a strength. The world may not always listen but that does not diminish the power of your voice. Keep showing up, keep leading, keep dreaming boldly. Your presence is a reminder that humanity is bigger than sound and your contributions continue to shape a world that is learning, slowly but surely, to see you clearly.

Short Advice to The Hearing Community

We must stop assuming that inclusion is something the Deaf must earn by adapting to us. Inclusion is a responsibility we all share, a commitment to expanding our imagination of who belongs.

My advice is simple: Learn enough to connect. And be humble enough to listen.

A few signs can open doors. A shift in language can restore dignity. A small effort from us can remove a lifelong burden from someone else. The Deaf do not need pity; they need partnership. Let us choose to meet them halfway.

Experience Meeting the Deaf Community

Meeting members of the Deaf community for the first time was both humbling and eye-opening. I encountered people who were not defined by their silence, but by their humor, intelligence, resilience and creativity. In every conversation — whether slow and careful or lively and expressive — I was reminded that communication is not limited to sound. It lives in hands, in eyes, in patience and in the willingness to understand.

Their openness taught me that the true barrier has never been deafness; it has been society's refusal to adapt. And standing among them, welcomed despite my imperfect signing, I realized that sign language is not merely a tool. It is an invitation, to community, to justice, to humanity.

Thank you`,
    },
    {
      slug: 'mwesigwa-david',
      name: 'Mwesigwa David',
      year: '2024',
      cohort: 'COHOT Class 2024',
      image: '/media/stories/mwesigwa-david.jpg',
      summary:
        'David is a Gospel minister whose journey with sign language has transformed his ministry and deepened his connection with the Deaf community. Through learning Ugandan Sign Language, he has found new ways to spread the Gospel and build bridges of understanding.',
      testimony: `Hello everyone, my name is Mwesigwa David, COHOT Class 2024.

I have loved and enjoyed using signs to communicate.

Sign Language helped me understand the Deaf culture and I have found no problem to communicate with them.

Sign language has helped me spread the Gospel of Christ without any hindrance.

Sign language has helped me to break that communication barrier between the hearing and the Deaf through having free interactions.

Sign language has given me an opportunity to be aware of the Deaf people and know how best to support them.

Sign language has equipped me with all the required skills to be able to support the Deaf.

My advice to the Deaf: Deaf people should come out and participate in the community. Deaf should know that God loves us all. Deaf people should be aware that we have equal opportunities. Deaf should find comfort in the Lord who has better plans for us all (Jeremiah 29:11).

The hearing should give all the necessary support to the Deaf, and should understand that being Deaf is not human making. The government and the church should rise and involve the Deaf in all they do, not catering for only the hearing, for an appropriate engagement.

Jesus loves us all the way we are; we need to love, welcome and embrace one another as Jesus did, irrespective of who we are (Psalm 133).`,
    },
    {
      slug: 'elizabeth-sebunya',
      name: 'Elizabeth Sebunya',
      year: '2025',
      image: '/media/stories/elizabeth-sebunya.jpg',
      summary:
        'Elizabeth joined sign language lessons in 2025 and discovered that learning sign language was not just about acquiring a new skill, but about embarking on an adventure that would transform her relationships and break down communication barriers.',
      testimony: `Hello, my name is Elizabeth Sebunya. I joined sign language lessons in 2025. Sign language has helped me so much by breaking the communication barriers between me and the Deaf community. Learning sign language has been an adventure for me — I've made new friends who are really lovely, which I didn't have before. It has also helped me learn a new language. Wow, what an experience!

Yes, my fellow people in the hearing community, I call on you to come and join, learn sign language, because you will make new friends and break down barriers. It is really amazing, and I don't think it's hard for you. My previous experience with the Deaf community made me think that it would be difficult to communicate with them, but after learning sign language, I found out that it is easy and simple. The Deaf people are very friendly, happy, and loving. I really thank God. Thank you.`,
    },
    {
      slug: 'namukwaya-sharon-kigongo',
      name: 'Namukwaya Sharon Kigongo',
      year: '2024',
      image: '/media/stories/namukwaya-sharon-kigongo.jpg',
      summary: 'Sharon shares how learning sign language opened her eyes to a unique and beautiful world, transforming her understanding of communication and her role as an interpreter.',
      testimony: `How do you feel learning sign language? I feel good learning another language and a new skill.

How has it changed your life? I can't really say that it has changed my life, but all I can say is that it has exposed me to a different world of the Deaf — a world of its own, very unique, peaceful and beautiful.

What do you enjoy most? I enjoy learning a new thing / sign every day. I enjoy talking to the Deaf people because it makes me feel very unique and important. I enjoy communicating with the Deaf as I interpret the message to a speaking person who doesn't understand sign language.

Advice to the community: They should create more awareness of their existence and teach more people sign language because it is really important.

Have you met or interacted with the Deaf community? Yes. My experience at first was not so good because they sign so fast, yet I was just learning the language. But when you catch up with the language, it flows well and you have meaningful conversations.`,
    },
    {
      slug: 'ssekamatte-yuda-morris',
      name: 'Ssekamatte Yuda Morris',
      year: '2025',
      cohort: 'Cohort 6',
      image: '/media/stories/ssekamatte-yuda-morris.jpg',
      summary: 'Yuda joined Cohort 6 in 2025 with a clear goal: to communicate easily with the Deaf community. His journey through sign language learning has been an awesome experience of discovery and connection.',
      testimony: `Name: Ssekamatte Yuda Morris, Cohort 6, 2025.

I chose to study sign language so that I can communicate with the Deaf and other people.

I feel awesome when I am learning sign language.

Sign language hasn't changed my life that much, but within a few months it will change it — I believe so.

I enjoy mostly how we interact with each other; even with my little skills, I enjoy it.

My advice to the community: they should learn sign language for easy communication between them and us, and it's good to learn many unique languages.`,
    },
    {
      slug: 'nalwanga-lilian',
      name: 'Nalwanga Lilian',
      year: '2025',
      cohort: 'Cohort 6',
      image: '/media/stories/nalwanga-lilian.jpg',
      summary: 'Lilian joined Cohort 6 in 2025 and discovered not just a new language, but a welcoming community and a sense of empowerment that comes from breaking down communication barriers.',
      testimony: `Name: Nalwanga Lilian, Cohort 6, 2025.

We interact with many people and sometimes we don't know how to respond to signs. I also have a friend who uses sign language and I hoped to communicate with him freely in signs.

I feel empowered and happy for myself that I have learnt something new and unique in this generation of ours.

I can understand what our friends of the Deaf community say and it feels great.

My instructors and everyone in the environment where we were learning were very welcoming, sweet, kind and so caring.

It's nice to learn something you might not notice that you need, but it will help you in future.`,
    },
  ],

  // Team as published on mcsli.org (newer than the repository, which listed different titles/photos).
  team: {
    leadership: [
      { name: 'Ssenyonjo Jim Maurice', position: 'Founder & Executive Director', image: '/media/team/ssenyonjo-jim-maurice.jpg' },
      { name: 'Bukenya Eric Paul', position: 'Program Coordinator', image: '/media/team/bukenya-eric-paul.jpg' },
      { name: 'Mulindwa Max', position: 'Treasurer', image: '/media/team/mulindwa-max.jpg' },
      { name: 'Kakooza Peter', position: 'Partnership and Communications Officer', image: '/media/team/kakooza-peter.jpg' },
    ],
    members: [
      { name: 'Ochen Morris', position: 'Graphic Designer', image: '/media/team/ochen-morris.jpg' },
      { name: 'Nakato Lilian', position: 'Sign Language Trainer', image: '/media/team/nakato-lilian.jpg' },
    ],
  },

  announcements: [],

  // Donation details exactly as published on mcsli.org/donate. Editable by admins.
  donation: {
    intro:
      'Your support helps MCSLI reach all districts in Uganda, providing awareness, training, and learning opportunities about sign language and the Deaf community to make communication easier and more inclusive.',
    bank: { bankName: 'dfcu Bank Uganda', accountName: 'Master Class Sign Language Initiative', accountNumber: '01660016165786', currency: 'UGX', swift: 'DFCU UG KA', note: 'Use the SWIFT code when sending money from abroad.' },
    mobileMoney: [
      { provider: 'MTN', label: 'MTN MoMo Pay', merchantCode: '407014' },
      { provider: 'Airtel', label: 'Airtel Money Pay', merchantCode: '4392640' },
    ],
    inKind: ['Training materials', 'Technology equipment', 'Professional services', 'Educational resources'],
    impactExamples: [
      { amount: 'UGX 50,000', impact: 'Provides basic training materials for 5 students' },
      { amount: 'UGX 100,000', impact: "Sponsors one student's complete 3-month programme" },
      { amount: 'UGX 250,000', impact: 'Funds a community awareness workshop in one district' },
      { amount: 'UGX 500,000', impact: "Supports a trainer's salary for one month" },
      { amount: 'UGX 1,000,000', impact: 'Establishes a training centre in a new district' },
    ],
    useOfFunds: [
      { title: 'Training programmes', description: 'Fund sign language training for individuals and organisations.' },
      { title: 'Educational materials', description: 'Develop and distribute learning resources and materials.' },
      { title: 'Community outreach', description: 'Expand our awareness campaigns to more communities.' },
      { title: 'Technology development', description: 'Build accessible learning platforms and mobile apps.' },
      { title: 'Youth empowerment', description: 'Support leadership and vocational training programmes.' },
      { title: 'Advocacy efforts', description: 'Fund policy engagement and rights advocacy activities.' },
    ],
  },

  shop: {
    intro: "Purchase our merchandise to support MCSLI's mission of empowering the Deaf community in Uganda. Every purchase directly funds our programmes and initiatives.",
    note: 'Orders are placed by message: tell us the item, size and quantity and we will confirm availability, payment and delivery.',
    products: [
      { id: 'polo-1', name: 'Ugandan Sign Language Alphabet Polo Shirt – White', description: 'Classic white polo shirt featuring the Ugandan Sign Language alphabet chart with traditional African art elements.', price: 'UGX 50,000', sizes: ['S', 'M', 'L', 'XL', 'XXL'], image: '/media/shop/polo-1.jpg' },
      { id: 'polo-2', name: 'Ugandan Sign Language Alphabet Polo Shirt – White (Version 2)', description: 'Elegant white polo with dark background alphabet chart design and MCSLI branding.', price: 'UGX 50,000', sizes: ['S', 'M', 'L', 'XL', 'XXL'], image: '/media/shop/polo-2.jpg' },
      { id: 'polo-3', name: 'Ugandan Sign Language Alphabet Polo Shirt – Premium White', description: 'Premium quality white polo shirt with detailed sign language alphabet and cultural artwork.', price: 'UGX 55,000', sizes: ['S', 'M', 'L', 'XL', 'XXL'], image: '/media/shop/polo-3.jpg' },
      { id: 'polo-4', name: 'Ugandan Sign Language Alphabet Polo Shirt – Sky Blue', description: 'Vibrant sky blue polo shirt with bold sign language alphabet design and African silhouettes.', price: 'UGX 55,000', sizes: ['S', 'M', 'L', 'XL', 'XXL'], image: '/media/shop/polo-4.jpg' },
      { id: 'polo-5', name: "Ugandan Sign Language Alphabet Polo Shirt – Sky Blue (Women's)", description: "Women's fit sky blue polo shirt with the complete Ugandan Sign Language alphabet chart.", price: 'UGX 55,000', sizes: ['XS', 'S', 'M', 'L', 'XL'], image: '/media/shop/polo-5.jpg' },
      { id: 'polo-6', name: 'Ugandan Sign Language Alphabet Polo Shirt – Classic White', description: 'Classic white polo with minimalist sign language alphabet design, perfect for everyday wear.', price: 'UGX 50,000', sizes: ['S', 'M', 'L', 'XL', 'XXL'], image: '/media/shop/polo-6.jpg' },
    ],
  },

  faq: [
    { category: 'Course', question: 'How is the online course structured?', answer: 'The course runs month by month. Each month has video lessons, practice signs, quizzes and a live assessment with your trainer. You unlock the next month after your trainer records a pass and your payments for that month are confirmed.' },
    { category: 'Course', question: 'What happens if I do not pass a monthly assessment?', answer: 'You will see "Assessment requires another attempt" on your dashboard. Review the lessons and practice signs; your trainer will schedule a reassessment. The next month stays locked until you pass.' },
    { category: 'Payment', question: 'What does the online course cost?', answer: 'Fees are shown on the Online Learning page and during registration. There is a one-time registration fee and tuition, which can be paid in full or in two installments. Ugandan and non-Ugandan students have different tuition rates.' },
    { category: 'Payment', question: 'How do I pay?', answer: 'Pay by bank transfer, MTN Mobile Money or Airtel Money using the details shown on your Payments page, then submit the transaction reference. MCSLI confirms every payment manually, usually within one working day.' },
    { category: 'Payment', question: 'Why is my payment still "Pending"?', answer: 'An MCSLI administrator has not yet matched it with the bank or mobile money statement. If it has been more than two working days, open a support request with your transaction reference.' },
    { category: 'Identity', question: 'Why do you need my National ID or passport?', answer: 'Your certificate must bear your legal name, and MCSLI needs to verify who is being assessed. Your identification number is stored securely, masked in the app, and documents are only visible to authorised MCSLI administrators.' },
    { category: 'Technical', question: 'Which devices can I use?', answer: 'Any modern phone, tablet or computer with a browser. Lessons are videos, so a stable connection helps; you can lower the playback quality or download resources where allowed.' },
    { category: 'Technical', question: 'Does the practice camera upload my video?', answer: 'No. The practice camera shows your own video next to the reference sign on your device only. Nothing is recorded or uploaded unless you explicitly submit a file for an assessment.' },
    { category: 'Certificate', question: 'How do I get my certificate?', answer: 'After you complete all lessons, quizzes, monthly assessments, the final examination and your payments, MCSLI approves and issues your certificate. It has a unique number and QR code that anyone can verify on mcsli.org.' },
  ],

  gallery_overrides: { hidden: [], captions: {} },
};
