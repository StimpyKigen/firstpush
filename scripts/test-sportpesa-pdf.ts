import { parseFixturesText } from '../src/lib/fixturePdfParser';

const sportpesaOcr = `
Sports Betting Homepage > Upcoming Games Thursday, October, 22th, 2026
ke.sportpesa.com Page 1 of 4
SportPesa
ID DATE TEAM 1 TEAM 2 3 WAY DOUBLE CHANCE OVER/UNDER 2.50 BOTH TEAMS TO SCORE
Home Draw Away 1 or X X or 2 1 or 2 Over Under Yes No
Vietnam - V-League 2
4729 22-10-2026 - 14:00 Gia Dinh PHO Hien FC 6.20 4.30 1.38 2.65 1.09 1.14 3.95 1.21 1.77 1.87 1.55 2.30
Indonesia - Super League
5339 22-10-2026 - 15:00 Persepam MU Persib Bandung 3.80 3.40 1.77 1.87 1.21 1.22 4.80 1.15 1.69 1.97 1.73 1.99
Jordan - Jordan 1st Division
2783 22-10-2026 - 15:00 Sama AL Sarhan DAR AL Dawa 3.25 3.05 2.07 1.64 1.27 1.27 6.00 1.10 1.80 1.84 1.97 1.75
Vietnam - V-League
1155 22-10-2026 - 15:15 Cong Anh Nhan Dan Thanh Hoa FC 1.20 5.80 8.80 1.05 3.80 1.08 3.50 1.26 1.96 1.69 1.46 2.55
Egypt - 2nd Division
2924 22-10-2026 - 15:30 Telecom Egypt Baladiyyat AL Mehalla 2.05 2.75 3.90 1.20 1.66 1.29 9.80 1.02 2.33 1.49 2.90 1.36
5455 22-10-2026 - 15:30 Dayrout EL Sekka EL Hadid 4.50 2.95 1.83 1.82 1.16 1.26 9.00 1.03 2.27 1.52 2.60 1.43
4881 22-10-2026 - 15:30 Maleyat Kafr El Zayat Kahroba AL Ismailia 2.75 2.70 2.70 1.38 1.37 1.31 8.80 1.03 2.06 1.63 2.60 1.44
3230 22-10-2026 - 15:30 Al Nasr Cairo El Daklyeh 1.82 3.05 4.30 1.17 1.83 1.24 7.60 1.05 2.03 1.65 2.27 1.56
5062 22-10-2026 - 15:30 Mega Sport Belqas Tanta FC 2.75 2.90 2.48 1.44 1.36 1.28 8.20 1.04 2.00 1.66 2.43 1.50
Brazil - U20 Carioca, Serie A2
3884 22-10-2026 - 16:00 Olaria AC RJ Audax Rio EC RJ 1.53 3.95 4.70 1.14 2.22 1.17 3.85 1.22 1.63 2.06 1.53 2.34
Montenegro - 1. CFL
5688 22-10-2026 - 16:00 Mornar Bar Mladost DG 1.54 3.60 5.20 1.12 2.20 1.20 5.00 1.13 1.85 1.78 1.78 1.92
Romania - Liga II
3280 22-10-2026 - 16:00 Bihor Scolar Resita 2.02 3.30 3.10 1.29 1.66 1.24 4.60 1.16 1.60 2.10 1.69 2.05
UAE - UAE President's Cup
5345 22-10-2026 - 16:00 Al Wasl Dubai Ittihad Kalba 1.40 4.40 5.60 1.10 2.60 1.14 3.10 1.32 1.56 2.18 1.39 2.80
3953 22-10-2026 - 16:00 Jazira Abu Dhabi Ajman Club 1.37 4.40 6.20 1.09 2.70 1.13 3.60 1.25 1.70 1.95 1.48 2.47
Iran - Pro League
3826 22-10-2026 - 16:30 Teraktor Sazi Sanat Naft Abadan FC 1.22 4.70 12.00 1.03 3.65 1.10 5.00 1.14 2.50 1.43 1.76 1.96
Uzbekistan - PFL
1248 22-10-2026 - 16:30 Bunyodkor Mash AL Mubarek 1.45 4.10 5.40 1.11 2.43 1.16 4.30 1.18 1.77 1.87 1.61 2.17
Saudi Arabia - Saudi Professional League
1654 22-10-2026 - 16:40 AL Hazm AL Faiha 2.20 3.30 3.00 1.37 1.62 1.33 1.68 2.06 1.83 1.87
India - Semifinal
2732 22-10-2026 - 17:00 Mizoram Police FC Dinthar FC 1.89 3.45 3.30 1.23 1.61 1.22
3559 22-10-2026 - 17:00 Chanmari FC Ramthar Veng FC 1.05 9.00 17.00 1.01 8.00 1.02 2.31 1.55 2.18 1.56 1.21 3.90
Iraq - Iraqi League
3191 22-10-2026 - 17:00 Zakho FC Arbil 2.85 2.90 2.36 1.48 1.34 1.29 6.60 1.08 1.85 1.79 2.10 1.65
Panama - Liga Prom, Apertura
5556 22-10-2026 - 17:00 Udelas FC Union Cocle FC B 1.30 4.90 6.80 1.07 3.05 1.11 3.05 1.33 1.64 2.04 1.37 2.85
International Clubs - UEFA Europa Conference League
3645 22-10-2026 - 17:30 Kairat Almaty Panathinaikos 5.00 4.00 1.65 2.20 1.19 1.25 1.80 1.91 1.78 1.97
Qatar - Stars League
5719 22-10-2026 - 17:30 Shahaniya SC Al Sadd SC 7.40 6.00 1.23 3.50 1.06 1.08 2.12 1.64 1.44 2.46 1.18 4.30
Saudi Arabia - Saudi Professional League
1315 22-10-2026 - 17:45 Al Fateh (KSA) Al Shabab Riyadh 2.90 3.60 2.13 1.65 1.39 1.29 3.75 1.23 1.46 2.55 1.51 2.40
Armenia - Premier League
2956 22-10-2026 - 18:00 Sardarapat FC Urartu 3.45 3.55 1.82 1.82 1.24 1.21 4.30 1.18 1.59 2.12 1.61 2.17
Finland - Final
5745 22-10-2026 - 18:00 RoPs Rovaniemi Kapa 2.20 3.45 2.75 1.36 1.57 1.21 4.00 1.20 1.47 2.37 1.57 2.26
Jordan - Jordan 1st Division
3987 22-10-2026 - 18:00 Al Sareeh Jerash 2.60 3.10 2.39 1.46 1.39 1.27 5.60 1.11 1.72 1.93 1.89 1.82
2358 22-10-2026 - 18:00 Al-Yarmouk Sahl Horan SC 2.29 2.90 3.00 1.31 1.53 1.30 7.80 1.05 2.04 1.64 2.37 1.52
Jordan - Jordan League
1724 22-10-2026 - 18:00 Hussein Irbid Doqarah FC 1.22 5.40 8.80 1.05 3.65 1.08 3.30 1.29 1.86 1.78 1.42 2.70
Israel - Ligat Al, Women
4886 22-10-2026 - 18:10 Maccabi Holon W FC Bnot Netanya W 1.09 7.20 15.00 1.02 5.80 1.04 2.70 1.41 2.12 1.59 1.30 3.20
1055 22-10-2026 - 18:10 MS Kiryat Gat W AS Tel Aviv Women W 1.46 4.20 5.00 1.12 2.41 1.15 3.00 1.34 1.49 2.32 1.36 2.90
1924 22-10-2026 - 18:10 Hapoel Katamon Jerusalem W Hapoel Tel Aviv W 1.13 6.80 12.00 1.03 4.90 1.05 2.65 1.42 1.88 1.76 1.29 3.30
5879 22-10-2026 - 18:10 Hapoel Raanana W Maccabi Kishronot Hadera W 2.90 3.65 1.99 1.69 1.32 1.21 3.90 1.21 1.52 2.27 1.54 2.32
Bahrain - Premier League
5741 22-10-2026 - 19:00 Sitra Club Riffa Club 5.40 3.60 1.53 2.24 1.12 1.19 5.60 1.11 1.97 1.69 1.88 1.82
5322 22-10-2026 - 19:00 Najma Manama Aali 2.19 3.00 3.05 1.30 1.57 1.28 6.20 1.09 1.82 1.82 2.03 1.70
Estonia - Esiliiga
1582 22-10-2026 - 19:00 Flora II FC Nomme United 1.99 4.10 2.70 1.38 1.68 1.18 1.96 1.75 1.19 3.85 1.15 4.70
Iraq - Iraqi League
5270 22-10-2026 - 19:00 Al-Gharraf SC AL Naft 3.05 2.80 2.29 1.52 1.30 1.31 7.80 1.05 2.05 1.63 2.41 1.50
Malta - Premier League, Opening Round
4013 22-10-2026 - 19:00 Birkirkara Floriana 2.80 3.20 2.22 1.56 1.35 1.26 5.40 1.12 1.70 1.95 1.84 1.86
Montenegro - 1. CFL
4268 22-10-2026 - 19:00 Buducnost FK Arsenal Tivat 1.42 3.85 6.40 1.09 2.50 1.17 5.00 1.13 1.98 1.68 1.78 1.93
UAE - UAE President's Cup
5068 22-10-2026 - 19:00 Shabab AL Ahli Dubai Club Al Ain 2.70 3.35 2.21 1.56 1.37 1.24 4.30 1.18 1.55 2.19 1.63 2.14
International Clubs - UEFA Europa League
1077 22-10-2026 - 19:45 OFI Crete Bayer Leverkusen 12.00 7.40 1.21 4.40 1.06 1.10 2.90 1.38 1.81 1.90 1.34 3.10
4841 22-10-2026 - 19:45 Union Saint Gilloise Hapoel Beer Sheva 1.36 5.40 7.60 1.11 3.10 1.16 3.70 1.25 1.75 1.96 1.49 2.50
3155 22-10-2026 - 19:45 Juventus Rennes 1.47 4.70 6.40 1.13 2.65 1.20 4.20 1.20 1.76 1.96 1.59 2.26
5661 22-10-2026 - 19:45 FC Ararat-Armenia AZ Alkmaar 7.20 5.20 1.39 2.95 1.12 1.17 3.70 1.25 1.72 2.01 1.49 2.49
3501 22-10-2026 - 19:45 Ferencvaros TC SCU Torreense 1.30 5.60 9.60 1.08 3.50 1.15 4.10 1.21 1.98 1.74 1.57 2.30
4126 22-10-2026 - 19:45 Dinamo Zagreb NEC Nijmegen 1.53 4.60 5.60 1.16 2.48 1.21 3.80 1.24 1.63 2.15 1.51 2.44
2932 22-10-2026 - 19:45 Lech Poznan Sunderland 4.60 3.85 1.74 2.06 1.21 1.27 5.20 1.14 1.74 1.97 1.77 1.98
3303 22-10-2026 - 19:45 Sturm Graz Marseille 3.90 3.75 1.90 1.87 1.27 1.28 4.60 1.17 1.60 2.19 1.66 2.14
International Clubs - UEFA Europa Conference League
3790 22-10-2026 - 19:45 Pafos FC Riga FC 1.62 4.20 5.20 1.18 2.26 1.24 4.90 1.15 1.76 1.95 1.72 2.05
4053 22-10-2026 - 19:45 FC Nordsjalland CSKA Sofia 1.44 5.00 6.60 1.13 2.75 1.18 3.90 1.23 1.71 2.02 1.53 2.41
3048 22-10-2026 - 19:45 Red Star Belgrade FC Copenhagen 2.33 3.60 2.90 1.41 1.58 1.30 4.80 1.16 1.58 2.24 1.69 2.09
3843 22-10-2026 - 19:45 Baumit Jablonec Brighton 14.00 7.60 1.18 4.80 1.05 1.09 3.30 1.30 2.05 1.69 1.42 2.75
5986 22-10-2026 - 19:45 Inter Club dEscaldes CS U Craiova 5.60 4.10 1.60 2.31 1.16 1.25 1.91 1.80 1.86 1.88
2641 22-10-2026 - 19:45 Trabzonspor Hearts 1.27 6.40 9.60 1.08 3.75 1.12 3.10 1.34 1.74 1.98 1.38 2.90
2817 22-10-2026 - 19:45 Saburtalo Tbilisi Mjallby 2.95 3.40 2.40 1.56 1.40 1.33 1.70 2.04 1.88 1.86
3814 22-10-2026 - 19:45 Kauno Zalgiris Brann 4.50 4.00 1.73 2.08 1.21 1.26 4.50 1.18 1.65 2.12 1.65 2.16
2276 22-10-2026 - 19:45 Getafe FC Lugano 1.98 3.35 4.00 1.25 1.80 1.33 1.91 1.80 2.12 1.67
Qatar - Stars League
4084 22-10-2026 - 19:45 Gharrafa SC Al Ahli Doha 1.92 3.75 3.05 1.30 1.74 1.20 3.05 1.33 1.38 2.65 1.37 2.85
Iraq - Iraqi League
4320 22-10-2026 - 20:00 AL Talaba Quwa Al Jawiya 2.60 2.70 2.75 1.36 1.40 1.33 6.60 1.08 1.81 1.82 2.13 1.64
Israel - Liga Alef North
4464 22-10-2026 - 20:00 SC Tira Hapoel Tirat Hacarmel 1.21 5.40 9.80 1.04 3.75 1.09 3.60 1.25 2.01 1.66 1.48 2.48
Israel - Liga Alef South
5158 22-10-2026 - 20:15 Hapoel Herzelia Hapoel Azur 2.31 3.15 2.80 1.36 1.52 1.24 6.20 1.09 1.75 1.89 1.99 1.73
Saudi Arabia - Saudi Professional League
2795 22-10-2026 - 21:00 Al Ahli Jeddah Al Khaleej Club 1.33 5.00 7.20 1.11 3.10 1.16 3.55 1.25 1.74 1.97 1.47 2.50
Ecuador - Serie B, Promotion Round
5769 22-10-2026 - 21:30 Club Deportivo Cuenca Juniors Atletico Rojiblanco 2.55 2.90 2.60 1.39 1.42 1.30 7.40 1.06 1.98 1.68 2.29 1.55
4848 22-10-2026 - 21:30 Cuniburo FC CD Alianza Cotopaxi 1.84 3.00 4.10 1.18 1.80 1.27 7.60 1.05 2.14 1.58 2.35 1.53
2368 22-10-2026 - 21:30 San Antonio FC 9 De Octubre FC 5.60 3.35 1.56 2.18 1.11 1.22 7.60 1.05 2.40 1.46 2.36 1.52
Malta - Premier League, Opening Round
1289 22-10-2026 - 21:30 Hibernians Gzira United FC 1.91 3.25 3.50 1.24 1.75 1.25 5.60 1.11 1.78 1.86 1.89 1.82
International Clubs - UEFA Europa League
4036 22-10-2026 - 22:00 Olympiakos Sparta Prague 1.52 4.40 6.20 1.14 2.50 1.22 5.00 1.15 1.85 1.85 1.73 2.04
5459 22-10-2026 - 22:00 Celtic Celta Vigo 2.75 3.45 2.55 1.51 1.45 1.32 4.70 1.16 1.56 2.28 1.69 2.09
3035 22-10-2026 - 22:00 Omonia Nicosia SL Benfica 8.05 5.37 1.35 3.30 1.09 1.15 3.85 1.24 1.84 1.87 1.52 2.44
4831 22-10-2026 - 22:00 Hoffenheim Lyon 2.06 4.00 3.15 1.36 1.74 1.26 3.50 1.27 1.44 2.60 1.46 2.60
4513 22-10-2026 - 22:00 NK Celje RB Salzburg 5.80 4.50 1.52 2.49 1.15 1.21 4.20 1.20 1.71 2.02 1.59 2.26
5291 22-10-2026 - 22:00 Besiktas Crystal Palace 2.28 3.75 2.90 1.41 1.61 1.29 3.65 1.26 1.43 2.60 1.49 2.50
5606 22-10-2026 - 22:00 Lillestrom Real Sociedad 6.20 4.80 1.47 2.65 1.14 1.19 3.85 1.23 1.68 2.06 1.53 2.41
1839 22-10-2026 - 22:00 Bournemouth AC Milan 1.95 3.80 3.70 1.29 1.83 1.28 4.80 1.16 1.63 2.15 1.70 2.08
5199 22-10-2026 - 22:00 Jagiellonia Anderlecht 3.05 3.55 2.27 1.61 1.38 1.31 4.90 1.15 1.60 2.20 1.72 2.04
4517 22-10-2026 - 22:00 Viktoria Plzen Levski Sofia 1.74 3.90 4.60 1.21 2.06 1.26 4.90 1.16 1.69 2.04 1.71 2.06
International Clubs - UEFA Europa Conference League
2661 22-10-2026 - 22:00 FC Midtjylland St. Truiden 1.69 4.10 4.70 1.20 2.14 1.25 4.10 1.21 1.59 2.22 1.56 2.32
5310 22-10-2026 - 22:00 Sporting Braga KAA Gent 1.91 3.50 4.10 1.25 1.86 1.31 1.97 1.75 2.14 1.66
2445 22-10-2026 - 22:00 Monaco SC Freiburg 2.20 3.60 3.15 1.36 1.65 1.30 4.70 1.17 1.57 2.26 1.67 2.11
1484 22-10-2026 - 22:00 Ajax Atalanta 2.13 3.80 3.15 1.36 1.69 1.28 3.50 1.28 1.42 2.65 1.46 2.60
4127 22-10-2026 - 22:00 AGF Aarhus Egnatia Rrogozhine 1.48 4.60 6.40 1.14 2.60 1.21 4.60 1.17 1.82 1.89 1.66 2.14
1530 22-10-2026 - 22:00 Borac Banja Luka KuPS Kuopio 1.83 3.65 4.30 1.23 1.94 1.29 1.85 1.86 1.94 1.80
2834 22-10-2026 - 22:00 FC Thun Hajduk Split 2.90 3.60 2.34 1.58 1.41 1.30 4.10 1.21 1.49 2.44 1.58 2.29
3172 22-10-2026 - 22:00 Lincoln FC Twente 12.00 7.20 1.21 4.50 1.05 1.10 3.15 1.33 1.91 1.80 1.39 2.85
Venezuela - Copa Venezuela, Playoffs
4505 22-10-2026 - 22:00 Metropolitanos Academia Anzoategui FC 1.45 4.20 5.40 1.11 2.45 1.14 3.80 1.22 1.64 2.05 1.52 2.36
Brazil - U20 Copa do Brasil
5573 22-10-2026 - 22:30 Botafogo RJ U20 Palmeiras SP U20 3.20 3.60 1.90 1.75 1.28 1.21 3.80 1.22 1.50 2.30 1.52 2.36
International Clubs - Copa Libertadores, Women, Group D
1641 22-10-2026 - 23:00 Libertad Limpeño Club Nacional Montevideo 2.15 3.10 3.05 1.30 1.59 1.27 6.80 1.07 1.91 1.73 2.13 1.64
2650 22-10-2026 - 23:00 Universidad de Chile W Asociacion Deportivo Cali W 2.80 3.15 2.25 1.54 1.35 1.26 6.80 1.07 1.91 1.73 2.12 1.64
Ecuador - Serie B, Relegation Round
5882 22-10-2026 - 23:00 Cumbaya FC El Nacional Quito 1.49 3.90 5.20 1.12 2.32 1.17 4.60 1.16 1.80 1.83 1.69 2.05
Brazil - U20 Copa do Brasil
5138 23-10-2026 - 01:00 Atletico Mineiro MG U20 Amazonas FC AM 1.31 4.60 7.40 1.07 3.00 1.12 3.15 1.31 1.66 2.01 1.39 2.75
Brazil - cupround
1561 23-10-2026 - 01:00 Fluminense FC RJ W Flamengo RJ W 2.80 3.30 2.22 1.56 1.36 1.22 5.40 1.12 1.65 2.03 1.81 1.90
International Clubs - CONCACAF Caribbean Cup
4227 23-10-2026 - 02:00 Mount Pleasant FC Club Sando 1.44 3.85 6.00 1.10 2.46 1.17 5.60 1.11 2.08 1.62 1.89 1.82
USA - USL Super League, Women
2530 23-10-2026 - 02:30 Fort Lauderdale United FC Carolina Uslw League 7.40 4.50 1.31 3.00 1.07 1.12 4.40 1.17 1.98 1.68 1.63 2.14
Venezuela - Copa Venezuela, Playoffs
5472 23-10-2026 - 02:30 Ucv FC Club Atletico Barinas 1.59 3.65 4.80 1.14 2.13 1.18 5.60 1.11 1.86 1.78 1.87 1.83
International Clubs - Copa Libertadores, Women, Group C
4845 23-10-2026 - 03:00 Liga Deportiva Universitaria de Quito Boliviar 1.35 4.60 6.20 1.08 2.80 1.13 3.15 1.31 1.62 2.07 1.40 2.75
2024 23-10-2026 - 03:00 Club Olimpia Cruzeiro EC MG W 6.40 4.40 1.35 2.75 1.08 1.13 4.10 1.19 1.85 1.79 1.58 2.23
Bolivia - Quarterfinal
1206 23-10-2026 - 03:00 Always Ready The Strongest 1.66 3.80 3.95 1.19 2.01 1.19 3.40 1.28 1.48 2.35 1.44 2.60
Brazil - Pernambucano, Group B
5964 23-10-2026 - 03:00 Porto PE Central PE 4.10 3.45 1.74 1.92 1.19 1.20 6.20 1.09 1.85 1.79 1.96 1.76
International Clubs - Copa Libertadores
2770 23-10-2026 - 03:30 Flamengo Estudiantes LP 1.26 4.70 9.60 1.05 3.35 1.11 5.60 1.11 2.50 1.43 1.87 1.83
International Clubs - CONCACAF Central American Cup
3742 23-10-2026 - 04:00 CD Motagua LD Alajuelense 2.16 2.95 3.15 1.29 1.59 1.29 6.40 1.08 1.85 1.79 2.07 1.67
`;

const res = parseFixturesText(sportpesaOcr);
console.log('Total Parsed Fixtures:', res.fixtures.length);
console.log('Sectored Leagues:');
console.log(JSON.stringify(res.sectoredLeagues, null, 2));
console.log('\nAll Parsed Fixtures:');
res.fixtures.forEach((f, idx) => {
  console.log(`[#${idx + 1}] [${f.country} - ${f.competition}] ${f.homeTeam} vs ${f.awayTeam} (${f.kickoffDisplay})`);
  console.log(`     1X2: ${f.odds.homeOdds} / ${f.odds.drawOdds} / ${f.odds.awayOdds} | DC: ${f.odds.doubleChance1X}/${f.odds.doubleChance12}/${f.odds.doubleChanceX2} | O2.5: ${f.odds.over25Odds} | U2.5: ${f.odds.under25Odds} | BTTS Y/N: ${f.odds.bttsYesOdds}/${f.odds.bttsNoOdds}`);
});
