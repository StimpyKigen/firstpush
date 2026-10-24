export interface ClubLogoItem {
  id: string;
  img: string;
  width: number;
  height: number;
  title: string;
  alt: string;
}

export const CLUB_LOGOS: ClubLogoItem[] = [
  {
    id: 'afc-leopards',
    img: '/images/club-logos/logo-01-afc-leopards-of-kenya-crest_.png',
    width: 512,
    height: 512,
    title: 'AFC Leopards',
    alt: 'AFC Leopards Crest',
  },
  {
    id: 'arsenal',
    img: '/images/club-logos/logo-02-arsenal.png',
    width: 512,
    height: 512,
    title: 'Arsenal',
    alt: 'Arsenal FC Crest',
  },
  {
    id: 'as-roma',
    img: '/images/club-logos/logo-03-as-roma-italia.png',
    width: 512,
    height: 512,
    title: 'AS Roma',
    alt: 'AS Roma Crest',
  },
  {
    id: 'atletico-madrid',
    img: '/images/club-logos/logo-04-atltico-madrid.png',
    width: 512,
    height: 512,
    title: 'Atlético Madrid',
    alt: 'Atlético Madrid Crest',
  },
  {
    id: 'bayern-munchen',
    img: '/images/club-logos/logo-05-bayern-mnchen.png',
    width: 512,
    height: 512,
    title: 'Bayern München',
    alt: 'Bayern München Crest',
  },
  {
    id: 'club-06',
    img: '/images/club-logos/logo-06-download-10.png',
    width: 512,
    height: 512,
    title: 'Football Club',
    alt: 'Club Crest',
  },
  {
    id: 'chelsea',
    img: '/images/club-logos/logo-07-download-2.png',
    width: 512,
    height: 512,
    title: 'Chelsea',
    alt: 'Chelsea FC Crest',
  },
  {
    id: 'dortmund',
    img: '/images/club-logos/logo-08-download-3.png',
    width: 512,
    height: 512,
    title: 'Borussia Dortmund',
    alt: 'Borussia Dortmund Crest',
  },
  {
    id: 'barcelona',
    img: '/images/club-logos/logo-09-download-4.png',
    width: 512,
    height: 512,
    title: 'FC Barcelona',
    alt: 'FC Barcelona Crest',
  },
  {
    id: 'club-10',
    img: '/images/club-logos/logo-10-download-5.png',
    width: 512,
    height: 512,
    title: 'Football Club',
    alt: 'Club Crest',
  },
  {
    id: 'club-11',
    img: '/images/club-logos/logo-11-download-6.png',
    width: 512,
    height: 512,
    title: 'Football Club',
    alt: 'Club Crest',
  },
  {
    id: 'juventus',
    img: '/images/club-logos/logo-12-download-7.png',
    width: 512,
    height: 512,
    title: 'Juventus',
    alt: 'Juventus Crest',
  },
  {
    id: 'ac-milan',
    img: '/images/club-logos/logo-13-download-8.png',
    width: 512,
    height: 512,
    title: 'AC Milan',
    alt: 'AC Milan Crest',
  },
  {
    id: 'club-14',
    img: '/images/club-logos/logo-14-download-9.png',
    width: 512,
    height: 512,
    title: 'Football Club',
    alt: 'Club Crest',
  },
  {
    id: 'gor-mahia',
    img: '/images/club-logos/logo-15-gor-mahia.png',
    width: 512,
    height: 512,
    title: 'Gor Mahia',
    alt: 'Gor Mahia FC Crest',
  },
  {
    id: 'liverpool',
    img: '/images/club-logos/logo-16-liverpool.png',
    width: 512,
    height: 512,
    title: 'Liverpool',
    alt: 'Liverpool FC Crest',
  },
  {
    id: 'man-city',
    img: '/images/club-logos/logo-17-manchester-city.png',
    width: 512,
    height: 512,
    title: 'Manchester City',
    alt: 'Manchester City Crest',
  },
  {
    id: 'man-united',
    img: '/images/club-logos/logo-18-manchester-united.png',
    width: 512,
    height: 512,
    title: 'Manchester United',
    alt: 'Manchester United Crest',
  },
  {
    id: 'real-madrid',
    img: '/images/club-logos/logo-19-real-madrid__.png',
    width: 512,
    height: 512,
    title: 'Real Madrid',
    alt: 'Real Madrid Crest',
  },
  {
    id: 'tottenham',
    img: '/images/club-logos/logo-20-tottenham-hotspur-fc-logo-vector-free-download.png',
    width: 512,
    height: 512,
    title: 'Tottenham Hotspur',
    alt: 'Tottenham Hotspur Crest',
  },
];

/**
 * Returns a randomized Fisher-Yates shuffle of the club logos for dynamic PWA loading presentations
 */
export function getShuffledClubLogos(): ClubLogoItem[] {
  const array = [...CLUB_LOGOS];
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}
