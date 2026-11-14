// Auto-generated list of club logos with uniform dimensions and accent color fill for GridMotion
export const CLUB_LOGOS: string[] = [
    "/images/club-logos/afc_leopards_of_kenya_crest__uniform.webp",
    "/images/club-logos/arsenal_uniform.webp",
    "/images/club-logos/as_roma______italia______uniform.webp",
    "/images/club-logos/atl_tico_madrid_uniform.webp",
    "/images/club-logos/bayern_m_nchen_uniform.webp",
    "/images/club-logos/download__10__uniform.webp",
    "/images/club-logos/download__2__uniform.webp",
    "/images/club-logos/download__3__uniform.webp",
    "/images/club-logos/download__4__uniform.webp",
    "/images/club-logos/download__5__uniform.webp",
    "/images/club-logos/download__6__uniform.webp",
    "/images/club-logos/download__7__uniform.webp",
    "/images/club-logos/download__8__uniform.webp",
    "/images/club-logos/download__9__uniform.webp",
    "/images/club-logos/gor_mahia_uniform.webp",
    "/images/club-logos/liverpool_uniform.webp",
    "/images/club-logos/manchester_city_uniform.webp",
    "/images/club-logos/manchester_united_uniform.webp",
    "/images/club-logos/real_madrid___uniform.webp",
    "/images/club-logos/tottenham_hotspur_fc_logo_vector_free_download_uniform.webp"
];

/**
 * Returns a randomized copy of the club logos array (Fisher-Yates shuffle)
 */
export const getShuffledClubLogos = (): string[] => {
  const shuffled = [...CLUB_LOGOS];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

