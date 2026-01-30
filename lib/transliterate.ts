/**
 * Enhanced Korean Transliteration Library
 * 
 * Features:
 * 1. Hangul Jamo Composition - Combines loose Jamos into proper syllables
 * 2. Word Dictionary - Proper nouns, place names, and loanwords
 * 3. Improved Katakana Mapping - Including compound characters and final consonants
 */

// ============================================================================
// HANGUL JAMO COMPOSITION UTILITIES
// ============================================================================

// Unicode constants for Hangul
const HANGUL_BASE = 0xAC00;  // '가'
const INITIAL_COUNT = 19;
const MEDIAL_COUNT = 21;
const FINAL_COUNT = 28;

// Jamo characters
const INITIALS = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
const MEDIALS = 'ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ';
const FINALS = '\0ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ';

// Check if a character is a Hangul Jamo
function isInitial(char: string): boolean {
    return INITIALS.includes(char);
}

function isMedial(char: string): boolean {
    return MEDIALS.includes(char);
}

function isFinal(char: string): boolean {
    return char !== '\0' && FINALS.includes(char);
}

// Check if character is a complete Hangul syllable
function isHangulSyllable(char: string): boolean {
    const code = char.charCodeAt(0);
    return code >= HANGUL_BASE && code <= HANGUL_BASE + 11171;
}

// Decompose a Hangul syllable into Jamos
function decomposeHangul(char: string): { initial: string; medial: string; final: string } | null {
    const code = char.charCodeAt(0);
    if (code < HANGUL_BASE || code > HANGUL_BASE + 11171) return null;

    const syllableIndex = code - HANGUL_BASE;
    const initialIndex = Math.floor(syllableIndex / (MEDIAL_COUNT * FINAL_COUNT));
    const medialIndex = Math.floor((syllableIndex % (MEDIAL_COUNT * FINAL_COUNT)) / FINAL_COUNT);
    const finalIndex = syllableIndex % FINAL_COUNT;

    return {
        initial: INITIALS[initialIndex],
        medial: MEDIALS[medialIndex],
        final: finalIndex === 0 ? '' : FINALS[finalIndex]
    };
}

// Compose Jamos into a Hangul syllable
function composeHangulSyllable(initial: string, medial: string, final: string = ''): string {
    const initialIndex = INITIALS.indexOf(initial);
    const medialIndex = MEDIALS.indexOf(medial);
    const finalIndex = final === '' ? 0 : FINALS.indexOf(final);

    if (initialIndex < 0 || medialIndex < 0 || finalIndex < 0) {
        return initial + medial + final; // Return as-is if can't compose
    }

    const code = HANGUL_BASE + (initialIndex * MEDIAL_COUNT + medialIndex) * FINAL_COUNT + finalIndex;
    return String.fromCharCode(code);
}

/**
 * Composes a string of mixed Jamos and syllables into proper Hangul
 * Handles cases like "보ㄴ피ㄴ" -> "본핀"
 */
function composeHangul(text: string): string {
    if (!text) return '';

    const result: string[] = [];
    let i = 0;

    while (i < text.length) {
        const char = text[i];

        // If it's a complete syllable, check if next char is a final consonant
        if (isHangulSyllable(char)) {
            const nextChar = text[i + 1];

            // Check if next char could be a final consonant (batchim)
            if (nextChar && isFinal(nextChar)) {
                // Check if char after that is a medial (vowel) - if so, nextChar is actually an initial
                const charAfterNext = text[i + 2];

                if (charAfterNext && isMedial(charAfterNext)) {
                    // nextChar is the initial of the next syllable, not a batchim
                    result.push(char);
                } else {
                    // nextChar is a batchim for current syllable
                    const decomposed = decomposeHangul(char);
                    if (decomposed && decomposed.final === '') {
                        // Add the batchim
                        const composed = composeHangulSyllable(decomposed.initial, decomposed.medial, nextChar);
                        result.push(composed);
                        i++; // Skip the consumed batchim
                    } else {
                        result.push(char);
                    }
                }
            } else {
                result.push(char);
            }
        }
        // If it's an initial Jamo followed by medial
        else if (isInitial(char)) {
            const nextChar = text[i + 1];

            if (nextChar && isMedial(nextChar)) {
                const thirdChar = text[i + 2];

                // Check for potential final consonant
                if (thirdChar && isFinal(thirdChar)) {
                    const fourthChar = text[i + 3];

                    // If fourth char is medial, third char is initial of next syllable
                    if (fourthChar && isMedial(fourthChar)) {
                        result.push(composeHangulSyllable(char, nextChar));
                        i += 2;
                    } else {
                        // Third char is batchim
                        result.push(composeHangulSyllable(char, nextChar, thirdChar));
                        i += 3;
                    }
                } else {
                    // No final consonant
                    result.push(composeHangulSyllable(char, nextChar));
                    i += 2;
                }
                continue;
            } else {
                result.push(char);
            }
        } else {
            result.push(char);
        }
        i++;
    }

    return result.join('');
}

// ============================================================================
// WORD DICTIONARY (PROPER NOUNS, PLACE NAMES, LOANWORDS)
// ============================================================================

const WORD_MAP: Record<string, string> = {
    // ============================================================
    // JAPANESE GRAMMAR / PARTICLES (Remove or translate)
    // ============================================================
    'です！': '입니다!',
    'です。': '입니다.',
    'です': '',  // Sentence-ending copula - remove
    'ます！': '합니다!',
    'ます。': '합니다.',
    'ます': '',  // Polite verb ending - remove
    'の綺麗な': ' 깨끗한',  // の as adjective connector
    'の施設': ' 시설',
    'の': ' ',  // Possessive particle - replace with space
    '～': '~',  // Keep wave dash

    // ============================================================
    // MAJOR STATION / AREA NAMES (Japanese Reading -> Korean)
    // ============================================================
    // Tokyo Major Areas
    '代々木': '요요기',
    '代々木競技場': '요요기 경기장',
    '原宿': '하라주쿠',
    '原宿駅': '하라주쿠역',
    '渋谷': '시부야',
    '渋谷駅': '시부야역',
    '新宿': '신주쿠',
    '新宿駅': '신주쿠역',
    '池袋': '이케부쿠로',
    '池袋駅': '이케부쿠로역',
    '銀座': '긴자',
    '銀座駅': '긴자역',
    '東京': '도쿄',
    '東京駅': '도쿄역',
    '品川': '시나가와',
    '品川駅': '시나가와역',
    '目黒': '메구로',
    '目黒駅': '메구로역',
    '恵比寿': '에비스',
    '恵比寿駅': '에비스역',
    '秋葉原': '아키하바라',
    '秋葉原駅': '아키하바라역',
    '上野': '우에노',
    '上野駅': '우에노역',
    '浅草': '아사쿠사',
    '浅草駅': '아사쿠사역',
    '六本木': '롯폰기',
    '六本木駅': '롯폰기역',
    '赤坂': '아카사카',
    '赤坂駅': '아카사카역',
    '麻布': '아자부',
    '麻布十番': '아자부주반',
    '台場': '다이바',
    'お台場': '오다이바',
    '錦糸町': '킨시초',
    '蒲田': '카마타',
    '大井町': '오이마치',
    '五反田': '고탄다',
    '田町': '다마치',
    '浜松町': '하마마츠초',
    '高田馬場': '다카다노바바',
    '新大久保': '신오쿠보',
    '中野': '나카노',
    '荻窪': '오기쿠보',
    '吉祥寺': '키치조지',
    '三鷹': '미타카',
    '調布': '초후',
    '府中': '후추',
    '町田': '마치다',
    '立川': '타치카와',
    '八王子': '하치오지',
    '三軒茶屋': '산겐자야',
    '下北沢': '시모키타자와',
    '中目黒': '나카메구로',
    '自由が丘': '지유가오카',
    '二子玉川': '후타코타마가와',
    '武蔵小杉': '무사시코스기',
    '溝の口': '미조노쿠치',
    'たまプラーザ': '타마프라자',
    '日吉': '히요시',
    '菊名': '키쿠나',
    '綱島': '츠나시마',
    '大倉山': '오쿠라야마',
    '白楽': '하쿠라쿠',
    '横浜': '요코하마',
    '横浜駅': '요코하마역',
    '川崎': '카와사키',
    '川崎駅': '카와사키역',
    '鶴見': '츠루미',
    '戸塚': '토츠카',
    '藤沢': '후지사와',
    '大船': '오후나',
    '鎌倉': '카마쿠라',
    '江ノ島': '에노시마',
    '茅ヶ崎': '치가사키',
    '平塚': '히라츠카',
    '小田原': '오다와라',
    '厚木': '아츠기',
    '海老名': '에비나',
    '相模大野': '사가미오노',
    '橋本': '하시모토',
    '落合': '오치아이',
    '落合南長崎': '오치아이 미나미나가사키',
    '落合南長崎駅': '오치아이 미나미나가사키역',
    '南長崎': '미나미나가사키',
    '日本橋': '니혼바시',
    '水道橋': '스이도바시',
    '飯田橋': '이이다바시',
    '神楽坂': '카구라자카',
    '後楽園': '코라쿠엔',
    '巣鴨': '스가모',
    '駒込': '코마고메',
    '西日暮里': '니시닛포리',
    '日暮里': '닛포리',
    '北千住': '키타센주',
    '南千住': '미나미센주',
    '亀戸': '카메이도',
    '両国': '료고쿠',
    '門前仲町': '몬젠나카초',
    '豊洲': '토요스',
    '有明': '아리아케',
    '新木場': '신키바',
    '葛西': '카사이',
    '西葛西': '니시카사이',
    '船橋': '후나바시',
    '津田沼': '츠다누마',
    '千葉': '치바',
    '幕張': '마쿠하리',
    '海浜幕張': '카이힌마쿠하리',
    '柏': '카시와',
    '松戸': '마츠도',
    '取手': '토리데',
    '大宮': '오미야',
    '浦和': '우라와',
    '川口': '카와구치',
    '草加': '소카',
    '越谷': '코시가야',
    '春日部': '카스카베',
    '所沢': '토코로자와',
    '川越': '카와고에',

    // Osaka Area
    '大阪': '오사카',
    '大阪駅': '오사카역',
    '梅田': '우메다',
    '難波': '난바',
    '心斎橋': '신사이바시',
    '天王寺': '텐노지',
    '京橋': '쿄바시',
    '新大阪': '신오사카',
    '淀屋橋': '요도야바시',
    '本町': '혼마치',

    // Other Major Cities
    '名古屋': '나고야',
    '京都': '교토',
    '神戸': '고베',
    '福岡': '후쿠오카',
    '札幌': '삿포로',
    '仙台': '센다이',
    '広島': '히로시마',
    '北九州': '키타큐슈',
    '那覇': '나하',

    // ============================================================
    // COMMON VENUE/FACILITY TERMS
    // ============================================================
    '競技場': '경기장',
    '体育館': '체육관',
    '運動場': '운동장',
    '総合運動場': '종합운동장',
    'スタジアム': '스타디움',
    'アリーナ': '아레나',
    'ドーム': '돔',
    'センター': '센터',
    'パーク': '파크',
    '公園': '공원',
    '広場': '광장',

    // ============================================================
    // DIRECTION / ACCESS TERMS
    // ============================================================
    '駅徒歩': '역 도보',
    '徒歩': '도보',
    '分': '분',
    '秒': '초',
    '直結': '직결',
    '駅直結': '역 직결',
    '出口': '출구',
    '北口': '북쪽출구',
    '南口': '남쪽출구',
    '東口': '동쪽출구',
    '西口': '서쪽출구',
    '中央口': '중앙출구',

    // ============================================================
    // LOANWORDS (Katakana -> Korean)
    // ============================================================
    'ボンフィン': '본핀',
    'フットサル': '풋살',
    'サッカー': '축구',
    'スポーツ': '스포츠',
    'コート': '코트',
    'アクセス': '접근성',
    'サービス': '서비스',
    'ステージ': '스테이지',
    'カテゴリー': '카테고리',
    'エンジョイ': '엔조이',
    'ミックス': '믹스',
    'キャンペーン': '캠페인',
    'コサル': '개인풋살',
    'アスタ': '아스타',
    'ビギナー': '비기너',
    'レベル': '레벨',
    'インドア': '인도어',
    'アウトドア': '아웃도어',

    // ============================================================
    // COMMON COMPOUND PHRASES
    // ============================================================
    'アクセス抜群': '접근성 최고',
    '綺麗な施設': '깨끗한 시설',
    '個人参加': '개인참가',
    '屋内コート': '실내 코트',
    '完全室内': '완전 실내',
    '初心者歓迎': '초보자 환영',
    '経験者向け': '유경험자 대상',
    '朝イチ': '아침 첫 타임',
    '個サル': '개인풋살',

    // ============================================================
    // FACILITY TYPE KEYWORDS
    // ============================================================
    '屋外': '야외',
    '屋上': '옥상',
    '室内': '실내',
    '屋内': '실내',

    // ============================================================
    // LEVEL / PARTICIPANT KEYWORDS
    // ============================================================
    '初心者': '초보자',
    '経験者': '경험자',
    '中級': '중급',
    '上級': '상급',
    '初級': '초급',
    '女性': '여성',
    '男性': '남성',

    // ============================================================
    // STATUS / ACTION KEYWORDS
    // ============================================================
    '中止': '중지',
    '開催': '개최',
    '割引': '할인',
    '募集': '모집',
    '綺麗': '깨끗한',
    '抜群': '최고',
};

// Sort by length (longer first) to prioritize longer matches
const WORD_MAP_KEYS = Object.keys(WORD_MAP).sort((a, b) => b.length - a.length);

// ============================================================================
// KATAKANA TO HANGUL MAPPING
// ============================================================================

// Multi-character combinations (sorted by length, longest first)
const KATAKANA_COMPOUNDS: [string, string][] = [
    // 3-character
    ['キャン', '캔'],
    ['シャー', '샤'],
    ['チャー', '차'],
    // 2-character - Palatalized sounds
    ['キャ', '캬'], ['キュ', '큐'], ['キョ', '쿄'],
    ['シャ', '샤'], ['シュ', '슈'], ['ショ', '쇼'],
    ['チャ', '차'], ['チュ', '추'], ['チョ', '초'],
    ['ニャ', '냐'], ['ニュ', '뉴'], ['ニョ', '뇨'],
    ['ヒャ', '햐'], ['ヒュ', '휴'], ['ヒョ', '효'],
    ['ミャ', '먀'], ['ミュ', '뮤'], ['ミョ', '묘'],
    ['リャ', '랴'], ['リュ', '류'], ['リョ', '료'],
    ['ギャ', '갸'], ['ギュ', '규'], ['ギョ', '교'],
    ['ジャ', '자'], ['ジュ', '주'], ['ジョ', '조'],
    ['ビャ', '뱌'], ['ビュ', '뷰'], ['ビョ', '뵤'],
    ['ピャ', '퍄'], ['ピュ', '퓨'], ['ピョ', '표'],
    // Special sounds
    ['イェ', '예'],
    ['ウィ', '위'], ['ウェ', '웨'], ['ウォ', '워'],
    ['ヴァ', '바'], ['ヴィ', '비'], ['ヴェ', '베'], ['ヴォ', '보'],
    ['シェ', '셰'], ['ジェ', '제'], ['チェ', '체'],
    ['ティ', '티'], ['ディ', '디'], ['デュ', '듀'],
    ['ファ', '파'], ['フィ', '피'], ['フェ', '페'], ['フォ', '포'],
    ['ツァ', '차'], ['ツィ', '치'], ['ツェ', '체'], ['ツォ', '초'],
    // Doubled consonants (っ)
    ['ッカ', '까'], ['ッキ', '끼'], ['ック', '끄'], ['ッケ', '께'], ['ッコ', '꼬'],
    ['ッサ', '싸'], ['ッシ', '씨'], ['ッス', '쓰'], ['ッセ', '쎄'], ['ッソ', '쏘'],
    ['ッタ', '따'], ['ッチ', '찌'], ['ッツ', '쯔'], ['ッテ', '떼'], ['ット', '또'],
    ['ッパ', '빠'], ['ッピ', '삐'], ['ップ', '뿌'], ['ッペ', '뻬'], ['ッポ', '뽀'],
];

// Single character mapping
const KATAKANA_SINGLE: Record<string, string> = {
    'ア': '아', 'イ': '이', 'ウ': '우', 'エ': '에', 'オ': '오',
    'カ': '카', 'キ': '키', 'ク': '쿠', 'ケ': '케', 'コ': '코',
    'サ': '사', 'シ': '시', 'ス': '스', 'セ': '세', 'ソ': '소',
    'タ': '타', 'チ': '치', 'ツ': '츠', 'テ': '테', 'ト': '토',
    'ナ': '나', 'ニ': '니', 'ヌ': '누', 'ネ': '네', 'ノ': '노',
    'ハ': '하', 'ヒ': '히', 'フ': '후', 'ヘ': '헤', 'ホ': '호',
    'マ': '마', 'ミ': '미', 'ム': '무', 'メ': '메', 'モ': '모',
    'ヤ': '야', 'ユ': '유', 'ヨ': '요',
    'ラ': '라', 'リ': '리', 'ル': '루', 'レ': '레', 'ロ': '로',
    'ワ': '와', 'ヲ': '오', 'ン': 'ㄴ',  // ン is final consonant
    'ガ': '가', 'ギ': '기', 'グ': '구', 'ゲ': '게', 'ゴ': '고',
    'ザ': '자', 'ジ': '지', 'ズ': '즈', 'ゼ': '제', 'ゾ': '조',
    'ダ': '다', 'ヂ': '지', 'ヅ': '즈', 'デ': '데', 'ド': '도',
    'バ': '바', 'ビ': '비', 'ブ': '부', 'ベ': '베', 'ボ': '보',
    'パ': '파', 'ピ': '피', 'プ': '푸', 'ペ': '페', 'ポ': '포',
    'ヴ': '브',
    'ー': '',  // Prolonged sound marker (handled specially)
    'ッ': '',  // Small tsu (handled in compounds or ignored)
};

// Hiragana to Hangul (for completeness)
const HIRAGANA_SINGLE: Record<string, string> = {
    'あ': '아', 'い': '이', 'う': '우', 'え': '에', 'お': '오',
    'か': '카', 'き': '키', 'く': '쿠', 'け': '케', 'こ': '코',
    'さ': '사', 'し': '시', 'す': '스', 'せ': '세', 'そ': '소',
    'た': '타', 'ち': '치', 'つ': '츠', 'て': '테', 'と': '토',
    'な': '나', 'に': '니', 'ぬ': '누', 'ね': '네', 'の': '노',
    'は': '하', 'ひ': '히', 'ふ': '후', 'へ': '헤', 'ほ': '호',
    'ま': '마', 'み': '미', 'む': '무', 'め': '메', 'も': '모',
    'や': '야', 'ゆ': '유', 'よ': '요',
    'ら': '라', 'り': '리', 'る': '루', 'れ': '레', 'ろ': '로',
    'わ': '와', 'を': '오', 'ん': 'ㄴ',
    'が': '가', 'ぎ': '기', 'ぐ': '구', 'げ': '게', 'ご': '고',
    'ざ': '자', 'じ': '지', 'ず': '즈', 'ぜ': '제', 'ぞ': '조',
    'だ': '다', 'ぢ': '지', 'づ': '즈', 'で': '데', 'ど': '도',
    'ば': '바', 'び': '비', 'ぶ': '부', 'べ': '베', 'ぼ': '보',
    'ぱ': '파', 'ぴ': '피', 'ぷ': '푸', 'ぺ': '페', 'ぽ': '포',
};

// Kanji to Hangul Eum-dok (Sino-Korean sound) - Keep for fallback
const KANJI_MAP: Record<string, string> = {
    '日': '일', '本': '본', '橋': '교', '中': '중', '央': '앙', '区': '구', '立': '립', '総': '총', '合': '합', '室': '실',
    '内': '내', '浜': '빈', '町': '정', '駅': '역', '分': '분', '時': '시', '間': '간', '個': '개', '人': '인', '参': '참',
    '加': '가', '都': '도', '丁': '정', '目': '목', '数': '수', '不': '부', '足': '족', '為': '위',
    '止': '지', '横': '횡', '神': '신', '奈': '나', '川': '천', '県': '현', '市': '시', '山': '산', '隔': '격', '週': '주',
    '催': '최', '経': '경', '験': '험', '者': '자', '向': '향', '先': '선', '着': '착', '割': '할', '名': '명',
    '水': '수', '曜': '요', '朝': '조', '座': '좌', '西': '서', '田': '전', '無': '무', '屋': '옥', '上': '상',
    '前': '전', '円': '원', '引': '인', '平': '평', '昼': '주', '出': '출', '完': '완', '全': '전', '和': '화', '光': '광',
    '成': '성', '増': '증', '埼': '기', '玉': '옥', '白': '백', '子': '자', '老': '노', '若': '약', '男': '남', '女': '여',
    '誰': '수', '楽': '락', '健': '건', '康': '강', '崎': '기', '高': '고', '津': '진', '蟹': '해', '谷': '곡', '当': '당',
    '予': '예', '約': '약', '詳': '상', '細': '세', '確': '확', '認': '인', '問': '문', '新': '신', '宿': '숙', '限': '한',
    '定': '정', '利': '이', '用': '용', '空': '공', '電': '전', '話': '화', '代': '대', '木': '목', '競': '경', '技': '기',
    '場': '장', '原': '원', '徒': '도', '歩': '보', '群': '군', '麗': '려', '施': '시', '設': '설',
    '渋': '삽', '南': '남', '国': '국', '第': '제', '一': '일', '体': '체', '育': '육', '館': '관', '落': '낙', '長': '장',
    '大': '대', '江': '강', '戸': '호', '線': '선', '結': '결', '豊': '풍', '島': '도', '吉': '길', '祥': '상',
    '寺': '사', '海': '해', '工': '공', '芝': '지', '更': '경', '衣': '의', '備': '비', '音': '음', '流': '류', '武': '무',
    '蔵': '장', '野': '야', '錦': '금', '糸': '사', '階': '계', '墨': '묵', '活': '활', '千': '천', '住': '주', '緑': '녹',
    '番': '번', '号': '호', '級': '급', '以': '이', '方': '방', '冷': '냉', '房': '방', '陽': '양', '砂': '사', '期': '기',
    '宮': '궁', '土': '토', '面': '면', '倒': '도', '要': '요', '保': '보', '試': '시', '筑': '축', '延': '연', '店': '점',
    '曙': '서', '柏': '백', '葉': '엽', '駒': '구', '台': '대', '優': '우', '連': '연', '絡': '락', '枠': '틀', '船': '선',
    '鎌': '겸', '倉': '창', '友': '우', '満': '만', '員': '원', '御': '어', '礼': '례', '天': '천', '下': '하', '茶': '다',
    '阪': '판', '府': '부', '岸': '안', '里': '리', '姫': '희', '路': '로', '兵': '병', '庫': '고', '八': '팔', '家': '가',
    '越': '월', '蒲': '포', '生': '생', '早': '조', '続': '속', '北': '북', '口': '구', '歳': '세', '性': '성', '湘': '상',
    '藤': '등', '沢': '택', '専': '전', '初': '초', '歓': '환', '迎': '영', '根': '근', '付': '부', '回': '회', '券': '권',
    '蘇': '소', '我': '아', '急': '급', '安': '안', '心': '심', '指': '지', '浦': '포', '広': '광', '尾': '미', '放': '방',
    '年': '년', '選': '선', '手': '수', '教': '교', '所': '소', '属': '속', '得': '득', '可': '가', '少': '소', '厚': '후',
    '愛': '애', '甲': '갑', '残': '잔', '営': '영', '業': '업', '終': '종', '了': '료', '料': '료', '古': '고', '知': '지',
    '村': '촌', '池': '지', '尼': '니', '塚': '총', '洲': '주', '幸': '행', '決': '결', '型': '형', '宇': '우', '品': '품',
    '能': '능', '学': '학', '対': '대', '象': '상', '通': '통', '常': '상', '金': '금', '幕': '막', '張': '장', '花': '화',
    '見': '견', '機': '기', '価': '가', '格': '격', '翼': '익', '梅': '매', '深': '심', '福': '복', '術': '술', '基': '기',
    '礎': '초', '鬼': '귀', '富': '부', '士': '사', '動': '동', '画': '화', '撮': '촬', '影': '영', '月': '월', '堺': '계',
    '美': '미', '材': '재', '之': '지', '泉': '천', '春': '춘', '部': '부', '後': '후', '単': '단', '発': '발', '低': '저',
    '多': '다', '摩': '마', '球': '구', '倶': '구', '河': '하', '練': '련', '習': '습', '会': '회', '王': '왕', '臼': '구',
    '板': '판', '蓮': '련', '外': '외', '仙': '선', '城': '성', '治': '치', '槇': '전', '清': '청', '茨': '자', '三': '삼',
    '丘': '구', '吹': '취', '駐': '주', '車': '차', '半': '반', '久': '구', '宝': '보', '龍': '용', '華': '화', '近': '근',
    '九': '구', '条': '조', '此': '차', '岡': '강', '博': '박', '那': '나', '珂': '가', '小': '소', '夜': '야', '鶴': '학',
    '沼': '소', '柴': '시', '橿': '강', '良': '양', '地': '지', '旭': '욱', '殿': '전', '周': '주', '州': '주', '幡': '번',
    '袖': '수', '最': '최', '枚': '매', '貰': '세', '待': '대', '登': '등', '録': '록', '元': '원', '道': '도', '徹': '철',
    '底': '저', '文': '문', '郷': '향', '重': '중', '視': '시', '軽': '경', '喫': '끽', '煙': '연', '超': '초', '運': '운',
    '慣': '관', '夢': '몽', '曽': '증', '霞': '하', '倍': '배', '六': '육', '有': '유', '調': '조', '布': '포', '味': '미',
    '素': '소', '脱': '탈', '入': '입', '門': '문', '火': '화', '商': '상', '棟': '동', '両': '양', '進': '진', '候': '후',
    '気': '기', '温': '온', '左': '좌', '右': '우', '快': '쾌', '適': '적', '戦': '전', '百': '백', '麻': '마', '万': '만',
    '妙': '묘', '典': '전', '街': '가', '同': '동', '勝': '승', '鴨': '압', '居': '거', '服': '복', '采': '채', '担': '담',
    '太': '태', '井': '정', '孔': '공', '晟': '성', '改': '개', '札': '찰', '蹴': '축', '松': '송', '森': '삼', '遽': '거',
    '薬': '약', '滝': '용', '証': '증', '港': '항', '貨': '화', '拡': '확', '募': '모', '集': '집', '雨': '우', '推': '추',
    '奨': '장', '制': '제', '度': '도', '爆': '폭', '印': '인', '冬': '동', '熱': '열', '量': '량', '取': '취', '鹿': '록',
    '黒': '흑', '晴': '청', '鴻': '홍', '巣': '소', '団': '단', '赤': '적', '坂': '판', '茂': '무', '関': '관', '景': '경',
    '吾': '오', '妻': '처', '栃': '회', '喜': '희', '馬': '마', '次': '차', '静': '정', '駿': '준', '丸': '환', '厳': '엄',
    '禁': '금', '熊': '웅', '主': '주', '栄': '영', '精': '정', '潟': '석', '牧': '목', '稲': '도', '坪': '평', '澤': '택',
    '郡': '군', '伏': '복', '桃': '도', '公': '공', '園': '원', '現': '현', '在': '재', '押': '압', '須': '수', '灘': '탄',
    '青': '청', '臨': '임', '岬': '갑', '庄': '장', '秘': '비', '密': '밀', '求': '구', '編': '편', '磨': '마', '的': '적',
    '明': '명', '石': '석', '貸': '대', '切': '절',
    // Prefecture suffixes
    '京': '경', '東': '동',
};

// ============================================================================
// MAIN TRANSLITERATION FUNCTION
// ============================================================================

/**
 * Transliterate Japanese text to Korean
 * 
 * @param text - Input Japanese text
 * @param lang - Target language ('ko' for Korean, 'ja' for pass-through)
 * @returns Transliterated text
 */
export function transliterate(text: string, lang: 'ko' | 'ja'): string {
    if (!text) return '';
    if (lang === 'ja') return text;

    // Step 1: Apply word dictionary (longest match first)
    let result = text;
    for (const key of WORD_MAP_KEYS) {
        if (result.includes(key)) {
            result = result.replaceAll(key, WORD_MAP[key]);
        }
    }

    // Step 2: Character-by-character transliteration
    let transliterated = '';
    let i = 0;

    while (i < result.length) {
        const char = result[i];
        let matched = false;

        // Check compound katakana patterns (up to 3 chars)
        for (const [pattern, hangul] of KATAKANA_COMPOUNDS) {
            const substr = result.substring(i, i + pattern.length);
            if (substr === pattern) {
                transliterated += hangul;
                i += pattern.length;
                matched = true;
                break;
            }
        }

        if (matched) continue;

        // Handle prolonged sound marker (ー) - extend previous vowel
        if (char === 'ー') {
            // In Korean, typically omitted or context-dependent. Skip for simplicity.
            i++;
            continue;
        }

        // Single Katakana
        if (KATAKANA_SINGLE[char]) {
            transliterated += KATAKANA_SINGLE[char];
            i++;
            continue;
        }

        // Single Hiragana
        if (HIRAGANA_SINGLE[char]) {
            transliterated += HIRAGANA_SINGLE[char];
            i++;
            continue;
        }

        // Kanji (fallback to Sino-Korean reading)
        if (KANJI_MAP[char]) {
            transliterated += KANJI_MAP[char];
            i++;
            continue;
        }

        // Pass through unchanged (punctuation, numbers, already Korean, etc.)
        transliterated += char;
        i++;
    }

    // Step 3: Compose Hangul Jamos into proper syllables
    return composeHangul(transliterated);
}

// Export for testing
export { composeHangul, WORD_MAP };
