import { EmbedBuilder } from 'discord.js';
import fs from 'fs/promises';
import fetch from 'node-fetch';
import Tesseract from 'tesseract.js';
import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import axios from 'axios';
import 'dotenv/config';
const webhookUrl = process.env.DEV_WEBHOOK;

const patterns = {
  invite_link: /discord(app)?(\.|．|｡|。|․)(com?[^\s]{1,}(servers|invite)[^\s]{1,}|gg[^\s]{1,})/i,
  special_word_link: /https?:\\?\/\\?\/[^\s]*(𝐚|𝐛|𝐜|𝐝|𝐞|𝐟|𝐠|𝐡|𝐢|𝐣|𝐤|𝐥|𝐦|𝐧|𝐨|𝐩|𝐪|𝐫|𝐬|𝐭|𝐮|𝐯|𝐰|𝐱|𝐲|𝐳|𝐀|𝐁|𝐂|𝐃|𝐄|𝐅|𝐆|𝐇|𝐈|𝐉|𝐊|𝐋|𝐌|𝐍|𝐎|𝐏|𝐐|𝐑|𝐒|𝐓|𝐔|𝐕|𝐖|𝐗|𝐘|𝐙|𝑎|𝑏|𝑐|𝑑|𝑒|𝑓|𝑔|ℎ|𝑖|𝑗|𝑘|𝑙|𝑚|𝑛|𝑜|𝑝|𝑞|𝑟|𝑠|𝑡|𝑢|𝑣|𝑤|𝑥|𝑦|𝑧|𝐴|𝐵|𝐶|𝐷|𝐸|𝐹|𝐺|𝐻|𝐼|𝐽|𝐾|𝐿|𝑀|𝑁|𝑂|𝑃|𝑄|𝑅|𝑆|𝑇|𝑈|𝑉|𝑊|𝑋|𝑌|𝑍|𝒂|𝒃|𝒄|𝒅|𝒆|𝒇|𝒈|𝒉|𝒊|𝒋|𝒌|𝒍|𝒎|𝒏|𝒐|𝒑|𝒒|𝒓|𝒔|𝒕|𝒖|𝒗|𝒘|𝒙|𝒚|𝒛|𝑨|𝑩|𝑪|𝑫|𝑬|𝑭|𝑮|𝑯|𝑰|𝑱|𝑲|𝑳|𝑴|𝑵|𝑶|𝑷|𝑸|𝑹|𝑺|𝑻|𝑼|𝑽|𝑾|𝑿|𝒀|𝒁|𝖺|𝖻|𝖼|𝖽|𝖾|𝖿|𝗀|𝗁|𝗂|𝗃|𝗄|𝗅|𝗆|𝗇|𝗈|𝗉|𝗊|𝗋|𝗌|𝗍|𝗎|𝗏|𝗐|𝗑|𝗒|𝗓|𝖠|𝖡|𝖢|𝖣|𝖤|𝖥|𝖦|𝖧|𝖨|𝖩|𝖪|𝖫|𝖬|𝖭|𝖮|𝖯|𝖰|𝖱|𝖲|𝖳|𝖴|𝖵|𝖶|𝖷|𝖸|𝖹|𝗮|𝗯|𝗰|𝗱|𝗲|𝗳|𝗴|𝗵|𝗶|𝗷|𝗸|𝗹|𝗺|𝗻|𝗼|𝗽|𝗾|𝗿|𝘀|𝘁|𝘂|𝘃|𝘄|𝘅|𝘆|𝘇|𝗔|𝗕|𝗖|𝗗|𝗘|𝗙|𝗚|𝗛|𝗜|𝗝|𝗞|𝗟|𝗠|𝗡|𝗢|𝗣|𝗤|𝗥|𝗦|𝗧|𝗨|𝗩|𝗪|𝗫|𝗬|𝗭|𝘢|𝘣|𝘤|𝘥|𝘦|𝘧|𝘨|𝘩|𝘪|𝘫|𝘬|𝘭|𝘮|𝘯|𝘰|𝘱|𝘲|𝘳|𝘴|𝘵|𝘶|𝘷|𝘸|𝘹|𝘺|𝘻|𝘈|𝘉|𝘊|𝘋|𝘌|𝘍|𝘎|𝘏|𝘐|𝘑|𝘒|𝘓|𝘔|𝘕|𝘖|𝘗|𝘘|𝘙|𝘚|𝘛|𝘜|𝘝|𝘞|𝘟|𝘠|𝘡|𝙖|𝙗|𝙘|𝙙|𝙚|𝙛|𝙜|𝙝|𝙞|𝙟|𝙠|𝙡|𝙢|𝙣|𝙤|𝙥|𝙦|𝙧|𝙨|𝙩|𝙪|𝙫|𝙬|𝙭|𝙮|𝙯|𝘼|𝘽|𝘾|𝘿|𝙀|𝙁|𝙂|𝙃|𝙄|𝙅|𝙆|𝙇|𝙈|𝙉|𝙊|𝙋|𝙌|𝙍|𝙎|𝙏|𝙐|𝙑|𝙒|𝙓|𝙔|𝙕|𝒶|𝒷|𝒸|𝒹|ℯ|𝒻|ℊ|𝒽|𝒾|𝒿|𝓀|𝓁|𝓂|𝓃|ℴ|𝓅|𝓆|𝓇|𝓈|𝓉|𝓊|𝓋|𝓌|𝓍|𝓎|𝓏|𝒜|ℬ|𝒞|𝒟|ℰ|ℱ|𝒢|ℋ|ℐ|𝒥|𝒦|ℒ|ℳ|𝒩|𝒪|𝒫|𝒬|ℛ|𝒮|𝒯|𝒰|𝒱|𝒲|𝒳|𝒴|𝒵|𝓪|𝓫|𝓬|𝓭|𝓮|𝓯|𝓰|𝓱|𝓲|𝓳|𝓴|𝓵|𝓶|𝓷|𝓸|𝓹|𝓺|𝓻|𝓼|𝓽|𝓾|𝓿|𝔀|𝔁|𝔂|𝔃|𝓐|𝓑|𝓒|𝓓|𝓔|𝓕|𝓖|𝓗|𝓘|𝓙|𝓚|𝓛|𝓜|𝓝|𝓞|𝓟|𝓠|𝓡|𝓢|𝓣|𝓤|𝓥|𝓦|𝓧|𝓨|𝓩|𝚊|𝚋|𝚌|𝚍|𝚎|𝚏|𝚐|𝚑|𝚒|𝚓|𝚔|𝚕|𝚖|𝚗|𝚘|𝚙|𝚚|𝚛|𝚜|𝚝|𝚞|𝚟|𝚠|𝚡|𝚢|𝚣|𝙰|𝙱|𝙲|𝙳|𝙴|𝙵|𝙶|𝙷|𝙸|𝙹|𝙺|𝙻|𝙼|𝙽|𝙾|𝙿|𝚀|𝚁|𝚂|𝚃|𝚄|𝚅|𝚆|𝚇|𝚈|𝚉|𝔞|𝔟|𝔠|𝔡|𝔢|𝔣|𝔤|𝔥|𝔦|𝔧|𝔨|𝔩|𝔪|𝔫|𝔬|𝔭|𝔮|𝔯|𝔰|𝔱|𝔲|𝔳|𝔴|𝔵|𝔶|𝔷|𝔄|𝔅|ℭ|𝔇|𝔈|𝔉|𝔊|ℌ|ℑ|𝔍|𝔎|𝔏|𝔐|𝔑|𝔒|𝔓|𝔔|ℜ|𝔖|𝔗|𝔘|𝔙|𝔚|𝔛|𝔜|ℨ|𝖆|𝖇|𝖈|𝖉|𝖊|𝖋|𝖌|𝖍|𝖎|𝖏|𝖐|𝖑|𝖒|𝖓|𝖔|𝖕|𝖖|𝖗|𝖘|𝖙|𝖚|𝖛|𝖜|𝖝|𝖞|𝖟|𝕬|𝕭|𝕮|𝕯|𝕰|𝕱|𝕲|𝕳|𝕴|𝕵|𝕶|𝕷|𝕸|𝕹|𝕺|𝕻|𝕼|𝕽|𝕾|𝕿|𝖀|𝖁|𝖂|𝖃|𝖄|𝖅|𝕒|𝕓|𝕔|𝕕|𝕖|𝕗|𝕘|𝕙|𝕚|𝕛|𝕜|𝕝|𝕞|𝕟|𝕠|𝕡|𝕢|𝕣|𝕤|𝕥|𝕦|𝕧|𝕨|𝕩|𝕪|𝕫|𝔸|𝔹|ℂ|𝔻|𝔼|𝔽|𝔾|ℍ|𝕀|𝕁|𝕂|𝕃|𝕄|ℕ|𝕆|ℙ|ℚ|ℝ|𝕊|𝕋|𝕌|𝕍|𝕎|𝕏|𝕐|ℤ|ａ|ｂ|ｃ|ｄ|ｅ|ｆ|ｇ|ｈ|ｉ|ｊ|ｋ|ｌ|ｍ|ｎ|ｏ|ｐ|ｑ|ｒ|ｓ|ｔ|ｕ|ｖ|ｗ|ｘ|ｙ|ｚ|Ａ|Ｂ|Ｃ|Ｄ|Ｅ|Ｆ|Ｇ|Ｈ|Ｉ|Ｊ|Ｋ|Ｌ|Ｍ|Ｎ|Ｏ|Ｐ|Ｑ|Ｒ|Ｓ|Ｔ|Ｕ|Ｖ|Ｗ|Ｘ|Ｙ|Ｚ|ⓐ|ⓑ|ⓒ|ⓓ|ⓔ|ⓕ|ⓖ|ⓗ|ⓘ|ⓙ|ⓚ|ⓛ|ⓜ|ⓝ|ⓞ|ⓟ|ⓠ|ⓡ|ⓢ|ⓣ|ⓤ|ⓥ|ⓦ|ⓧ|ⓨ|ⓩ|Ⓐ|Ⓑ|Ⓒ|Ⓓ|Ⓔ|Ⓕ|Ⓖ|Ⓗ|Ⓘ|Ⓙ|Ⓚ|Ⓛ|Ⓜ|Ⓝ|Ⓞ|Ⓟ|Ⓠ|Ⓡ|Ⓢ|Ⓣ|Ⓤ|Ⓥ|Ⓦ|Ⓧ|Ⓨ|Ⓩ|🄰|🄱|🄲|🄳|🄴|🄵|🄶|🄷|🄸|🄹|🄺|🄻|🄼|🄽|🄾|🄿|🅀|🅁|🅂|🅃|🅄|🅅|🅆|🅇|🅈|🅉|ᵃ|ᵇ|ᶜ|ᵈ|ᵉ|ᶠ|ᵍ|ʰ|ⁱ|ʲ|ᵏ|ˡ|ᵐ|ⁿ|ᵒ|ᵖ|ʳ|ʳ|ˢ|ᵗ|ᵘ|ᵛ|ʷ|ˣ|ʸ|ᶻ|ᴬ|ᴮ|ᴰ|ᴰ|ᴳ|ᴴ|ᴵ|ᴶ|ᴷ|ᴸ|ᴹ|ᴺ|ᴼ|ᴾ|ᴿ|ᵀ|ᵁ|ⱽ|ᵂ|ₐ|ₑ|ₕ|ᵢ|ⱼ|ₖ|ₗ|ₘ|ₙ|ₒ|ₚ|ᵣ|ₛ|ₜ|ᵤ|ᵥ|ₓ|𝟎|𝟏|𝟐|𝟑|𝟒|𝟓|𝟔|𝟕|𝟖|𝟗|𝟘|𝟙|𝟚|𝟛|𝟜|𝟝|𝟞|𝟟|𝟠|𝟡|𝟢|𝟣|𝟤|𝟥|𝟦|𝟧|𝟨|𝟩|𝟪|𝟫|𝟬|𝟭|𝟮|𝟯|𝟰|𝟱|𝟲|𝟳|𝟴|𝟵|𝟶|𝟷|𝟸|𝟹|𝟺|𝟻|𝟼|𝟽|𝟾|𝟿|０|１|２|３|４|５|６|７|８|９){1,}([ ]|[　]|\n)?/,
  redirect_link: /((youtube(\.|．|｡|。|․)com\/redirect)|(google(\.|．|｡|。|․)com\/url))/i,
  line_link: /\<(\n{1,})?h(\n{1,})?t(\n{1,})?t(\n{1,})?p(\n{1,})?s?(\n{1,})?:(\n{1,})?\/(\n{1,})?\/(\n{1,})?([^\s]{1,}|\n{1,}){1,}\>/i,
  encode_link: /https?:\/\/[^\s%]*%[0-9A-Fa-f]{2}[^\s]{1,}/i,
  short_link: /https?:\\?\/\\?\/[^\s]*(0rz(\.|．|｡|。|․)tw|1-url(\.|．|｡|。|․)net|126(\.|．|｡|。|․)am|1tk(\.|．|｡|。|․)us|1un(\.|．|｡|。|․)fr|1url(\.|．|｡|。|․)com|1url(\.|．|｡|。|․)cz|1wb2(\.|．|｡|。|․)net|2(\.|．|｡|。|․)gp|2(\.|．|｡|。|․)ht|2ad(\.|．|｡|。|․)in|2doc(\.|．|｡|。|․)net|2fear(\.|．|｡|。|․)com|2long(\.|．|｡|。|․)cc|2tu(\.|．|｡|。|․)us|2ty(\.|．|｡|。|․)in|2u(\.|．|｡|。|․)xf(\.|．|｡|。|․)cz|3ra(\.|．|｡|。|․)be|3x(\.|．|｡|。|․)si|4i(\.|．|｡|。|․)ae|4view(\.|．|｡|。|․)me|5em(\.|．|｡|。|․)cz|5url(\.|．|｡|。|․)net|5z8(\.|．|｡|。|․)info|6fr(\.|．|｡|。|․)ru|6g6(\.|．|｡|。|․)eu|7(\.|．|｡|。|․)ly|76(\.|．|｡|。|․)gd|77(\.|．|｡|。|․)ai|7fth(\.|．|｡|。|․)cc|7li(\.|．|｡|。|․)in|7vd(\.|．|｡|。|․)cn|8u(\.|．|｡|。|․)cz|944(\.|．|｡|。|․)la|98(\.|．|｡|。|․)to|9qr(\.|．|｡|。|․)de|L9(\.|．|｡|。|․)fr|Lvvk(\.|．|｡|。|․)com|To8(\.|．|｡|。|․)cc|aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa(\.|．|｡|。|․)com|a0(\.|．|｡|。|․)fr|abbr(\.|．|｡|。|․)sk|abcn(\.|．|｡|。|․)ws|ad-med(\.|．|｡|。|․)cz|ad5(\.|．|｡|。|․)eu|ad7(\.|．|｡|。|․)biz|adb(\.|．|｡|。|․)ug|adf(\.|．|｡|。|․)ly|adfa(\.|．|｡|。|․)st|adfly(\.|．|｡|。|․)fr|adli(\.|．|｡|。|․)pw|adv(\.|．|｡|。|․)li|ajn(\.|．|｡|。|․)me|aka(\.|．|｡|。|․)gr|alil(\.|．|｡|。|․)in|any(\.|．|｡|。|․)gs|apne(\.|．|｡|。|․)ws|aqva(\.|．|｡|。|․)pl|ares(\.|．|｡|。|․)tl|asso(\.|．|｡|。|․)in|au(\.|．|｡|。|․)ms|ayt(\.|．|｡|。|․)fr|azali(\.|．|｡|。|․)fr|b00(\.|．|｡|。|․)fr|b23(\.|．|｡|。|․)ru|b54(\.|．|｡|。|․)in|baid(\.|．|｡|。|․)us|bc(\.|．|｡|。|․)vc|bee4(\.|．|｡|。|․)biz|bim(\.|．|｡|。|․)im|bit(\.|．|｡|。|․)do|bit(\.|．|｡|。|․)ly|bitly(\.|．|｡|。|․)com|bitw(\.|．|｡|。|․)in|blap(\.|．|｡|。|․)net|ble(\.|．|｡|。|․)pl|blip(\.|．|｡|。|․)tv|boi(\.|．|｡|。|․)re|bote(\.|．|｡|。|․)me|bougn(\.|．|｡|。|․)at|br4(\.|．|｡|。|․)in|brk(\.|．|｡|。|․)to|brzu(\.|．|｡|。|․)net|buff(\.|．|｡|。|․)ly|bul(\.|．|｡|。|․)lu|bxl(\.|．|｡|。|․)me|bzh(\.|．|｡|。|․)me|cachor(\.|．|｡|。|․)ro|captur(\.|．|｡|。|․)in|cbs(\.|．|｡|。|․)so|cbsn(\.|．|｡|。|․)ws|cbug(\.|．|｡|。|․)cc|cc(\.|．|｡|。|․)cc|ccj(\.|．|｡|。|․)im|cf(\.|．|｡|。|․)ly|cf2(\.|．|｡|。|․)me|cf6(\.|．|｡|。|․)co|cjb(\.|．|｡|。|․)net|cli(\.|．|｡|。|․)gs|clikk(\.|．|｡|。|․)in|cn86(\.|．|｡|。|․)org|couic(\.|．|｡|。|․)fr|cr(\.|．|｡|。|․)tl|cudder(\.|．|｡|。|․)it|cur(\.|．|｡|。|․)lv|curl(\.|．|｡|。|․)im|cut(\.|．|｡|。|․)pe|cut(\.|．|｡|。|․)sk|cutt(\.|．|｡|。|․)eu|cutt(\.|．|｡|。|․)ly|cutt(\.|．|｡|。|․)us|cutu(\.|．|｡|。|․)me|cybr(\.|．|｡|。|․)fr|cyonix(\.|．|｡|。|․)to|d75(\.|．|｡|。|․)eu|daa(\.|．|｡|。|․)pl|dai(\.|．|｡|。|․)ly|dd(\.|．|｡|。|․)ma|ddp(\.|．|｡|。|․)net|dft(\.|．|｡|。|․)ba|dlvr(\.|．|｡|。|․)it|doiop(\.|．|｡|。|․)com|dolp(\.|．|｡|。|․)cc|dopice(\.|．|｡|。|․)sk|droid(\.|．|｡|。|․)ws|dv(\.|．|｡|。|․)gd|dyo(\.|．|｡|。|․)gs|e37(\.|．|｡|。|․)eu|ecra(\.|．|｡|。|․)se|ely(\.|．|｡|。|․)re|erax(\.|．|｡|。|․)cz|erw(\.|．|｡|。|․)cz|e(\.|．|｡|。|․)vg|ex9(\.|．|｡|。|․)co|ezurl(\.|．|｡|。|․)cc|fast\-links(\.|．|｡|。|․)org|fff(\.|．|｡|。|․)re|fff(\.|．|｡|。|․)to|fff(\.|．|｡|。|․)wf|filz(\.|．|｡|。|․)fr|fnk(\.|．|｡|。|․)es|foe(\.|．|｡|。|․)hn|folu(\.|．|｡|。|․)me|freze(\.|．|｡|。|․)it|fur(\.|．|｡|。|․)ly|fxn(\.|．|｡|。|․)ws|g00(\.|．|｡|。|․)me|gg(\.|．|｡|。|․)gg|goo(\.|．|｡|。|․)gl|goo-gl(\.|．|｡|。|․)me|goo(\.|．|｡|。|․)lu|grem(\.|．|｡|。|․)io|guiama(\.|．|｡|。|․)is|hadej(\.|．|｡|。|․)co|hide(\.|．|｡|。|․)my|hill(\.|．|｡|。|․)cm|hjkl(\.|．|｡|。|․)fr|hops(\.|．|｡|。|․)me|href(\.|．|｡|。|․)li|ht(\.|．|｡|。|․)ly|i-2(\.|．|｡|。|․)co|i99(\.|．|｡|。|․)cz|icit(\.|．|｡|。|․)fr|ick(\.|．|｡|。|․)li|icks(\.|．|｡|。|․)ro|iiiii(\.|．|｡|。|․)in|iky(\.|．|｡|。|․)fr|ilix(\.|．|｡|。|․)in|info(\.|．|｡|。|․)ms|is(\.|．|｡|。|․)gd|isra(\.|．|｡|。|․)li|itm(\.|．|｡|。|․)im|ity(\.|．|｡|。|․)im|ix(\.|．|｡|。|․)sk|j(\.|．|｡|。|․)gs|j(\.|．|｡|。|․)mp|jdem(\.|．|｡|。|․)cz|jieb(\.|．|｡|。|․)be|jp22(\.|．|｡|。|․)net|jqw(\.|．|｡|。|․)de|kask(\.|．|｡|。|․)us|kfd(\.|．|｡|。|․)pl|korta(\.|．|｡|。|․)nu|kr3w(\.|．|｡|。|․)de|krat(\.|．|｡|。|․)si|kratsi(\.|．|｡|。|․)cz|krod(\.|．|｡|。|․)cz|kuc(\.|．|｡|。|․)cz|kxb(\.|．|｡|。|․)me|l-k(\.|．|｡|。|․)be|lc-s(\.|．|｡|。|․)co|lc(\.|．|｡|。|․)cx|lcut(\.|．|｡|。|․)in|letop10(\.|．|｡|。|․)|libero(\.|．|｡|。|․)it|lick(\.|．|｡|。|․)my|lien(\.|．|｡|。|․)li|lien(\.|．|｡|。|․)pl|lin(\.|．|｡|。|․)io|linkn(\.|．|｡|。|․)co|llu(\.|．|｡|。|․)ch|lnk(\.|．|｡|。|․)co|lnk(\.|．|｡|。|․)ly|lnk(\.|．|｡|。|․)sk|lnks(\.|．|｡|。|․)fr|lnky(\.|．|｡|。|․)fr|lnp(\.|．|｡|。|․)sn|l8(\.|．|｡|。|․)nu|lp25(\.|．|｡|。|․)fr|m1p(\.|．|｡|。|․)fr|m3mi(\.|．|｡|。|․)com|make(\.|．|｡|。|․)my|mcaf(\.|．|｡|。|․)ee|mdl29(\.|．|｡|。|․)net|mic(\.|．|｡|。|․)fr|migre(\.|．|｡|。|․)me|minu(\.|．|｡|。|․)me|more(\.|．|｡|。|․)sh|mut(\.|．|｡|。|․)lu|myurl(\.|．|｡|。|․)in|nbcnews(\.|．|｡|。|․)to|net(\.|．|｡|。|․)ms|net46(\.|．|｡|。|․)net|nicou(\.|．|｡|。|․)ch|nig(\.|．|｡|。|․)gr|nov(\.|．|｡|。|․)io|nq(\.|．|｡|。|․)st|nxy(\.|．|｡|。|․)in|nyti(\.|．|｡|。|․)ms|o-x(\.|．|｡|。|․)fr|okok(\.|．|｡|。|․)fr|ou(\.|．|｡|。|․)af|ou(\.|．|｡|。|․)gd|oua(\.|．|｡|。|․)be|ow(\.|．|｡|。|․)ly|p(\.|．|｡|。|․)pw|parky(\.|．|｡|。|․)tv|past(\.|．|｡|。|․)is|pdh(\.|．|｡|。|․)co|ph(\.|．|｡|。|․)ly|pich(\.|．|｡|。|․)in|pin(\.|．|｡|。|․)st|plots(\.|．|｡|。|․)fr|plots(\.|．|｡|。|․)fr|pm(\.|．|｡|。|․)wu(\.|．|｡|。|․)cz|po(\.|．|｡|。|․)st|ppfr(\.|．|｡|。|․)it|ppst(\.|．|｡|。|․)me|ppt(\.|．|｡|。|․)cc|ppt(\.|．|｡|。|․)li|prejit(\.|．|｡|。|․)cz|ptab(\.|．|｡|。|․)it|ptm(\.|．|｡|。|․)ro|pw2(\.|．|｡|。|․)ro|py6(\.|．|｡|。|․)ru|q(\.|．|｡|。|․)gs|qbn(\.|．|｡|。|․)ru|qqc(\.|．|｡|。|․)co|qr(\.|．|｡|。|․)net|qrtag(\.|．|｡|。|․)fr|qxp(\.|．|｡|。|․)cz|qxp(\.|．|｡|。|․)sk|rb6(\.|．|｡|。|․)co|rb(\.|．|｡|。|․)gy|rcknr(\.|．|｡|。|․)io|rdz(\.|．|｡|。|․)me|redir(\.|．|｡|。|․)ec|redir(\.|．|｡|。|․)fr|redu(\.|．|｡|。|․)it|ref(\.|．|｡|。|․)so|reise(\.|．|｡|。|․)lc|relink(\.|．|｡|。|․)fr|reut(\.|．|｡|。|․)rs|ri(\.|．|｡|。|․)ms|riz(\.|．|｡|。|․)cz|rod(\.|．|｡|。|․)gs|roflc(\.|．|｡|。|․)at|rt(\.|．|｡|。|․)se|s-url(\.|．|｡|。|․)fr|safe(\.|．|｡|。|․)mn|sagyap(\.|．|｡|。|․)tk|sc(\.|．|｡|。|․)link|sdu(\.|．|｡|。|․)sk|seeme(\.|．|｡|。|․)at|segue(\.|．|｡|。|․)se|sh(\.|．|｡|。|․)st|sh(\.|．|｡|。|․)st|shb(\.|．|｡|。|․)red|shar(\.|．|｡|。|․)as|shiny(\.|．|｡|。|․)link|short(\.|．|｡|。|․)cc|shot-link(\.|．|｡|。|․)me|short(\.|．|｡|。|․)ie|short(\.|．|｡|。|․)pk|shrt(\.|．|｡|。|․)in|shrt(\.|．|｡|。|․)io|shrtco(\.|．|｡|。|․)de|shy(\.|．|｡|。|․)si|sicax(\.|．|｡|。|․)net|sina(\.|．|｡|。|․)lt|sk(\.|．|｡|。|․)gy|skr(\.|．|｡|。|․)sk|skroc(\.|．|｡|。|․)pl|smll(\.|．|｡|。|․)co|sn(\.|．|｡|。|․)im|snsw(\.|．|｡|。|․)us|soo(\.|．|｡|。|․)gd|spn(\.|．|｡|。|․)sr|sq6(\.|．|｡|。|․)ru|ssl(\.|．|｡|。|․)gs|su(\.|．|｡|。|․)pr|surl(\.|．|｡|。|․)me|sux(\.|．|｡|。|․)cz|sy(\.|．|｡|。|․)pe|t(\.|．|｡|。|․)cn|t(\.|．|｡|。|․)co|t(\.|．|｡|。|․)me|ta(\.|．|｡|。|․)gd|tabzi(\.|．|｡|。|․)com|tau(\.|．|｡|。|․)pe|tdjt(\.|．|｡|。|․)cz|tamg(\.|．|｡|。|․)cc|tek(\.|．|｡|。|․)io|thesa(\.|．|｡|。|․)us|tin(\.|．|｡|。|․)li|tini(\.|．|｡|。|․)cc|tiny(\.|．|｡|。|․)cc|tiny(\.|．|｡|。|․)lt|tiny(\.|．|｡|。|․)ms|tiny(\.|．|｡|。|․)pl|tinyurl(\.|．|｡|。|․)com|tinyurl(\.|．|｡|。|․)hu|tixsu(\.|．|｡|。|․)com|tldr(\.|．|｡|。|․)sk|tllg(\.|．|｡|。|․)net|tnij(\.|．|｡|。|․)org|tny(\.|．|｡|。|․)cz|to(\.|．|｡|。|․)ly|tohle(\.|．|｡|。|․)de|tpmr(\.|．|｡|。|․)com|tr(\.|．|｡|。|․)im|tr5(\.|．|｡|。|․)in|trck(\.|．|｡|。|․)me|trib(\.|．|｡|。|․)al|trick(\.|．|｡|。|․)ly|trkr(\.|．|｡|。|․)ws|trunc(\.|．|｡|。|․)it|twet(\.|．|｡|。|․)fr|twi(\.|．|｡|。|․)im|twlr(\.|．|｡|。|․)me|twurl(\.|．|｡|。|․)nl|u(\.|．|｡|。|․)to|uby(\.|．|｡|。|․)es|ucam(\.|．|｡|。|․)me|ug(\.|．|｡|。|․)cz|ulmt(\.|．|｡|。|․)in|unlc(\.|．|｡|。|․)us|upzat(\.|．|｡|。|․)com|ur1(\.|．|｡|。|․)ca|url2(\.|．|｡|。|․)fr|url5(\.|．|｡|。|․)org|urlin(\.|．|｡|。|․)it|urls(\.|．|｡|。|․)fr|urlz(\.|．|｡|。|․)fr|urub(\.|．|｡|。|․)us|utfg(\.|．|｡|。|․)sk|v(\.|．|｡|。|․)gd|v(\.|．|｡|。|․)ht|v5(\.|．|｡|。|․)gd|vaaa(\.|．|｡|。|․)fr|valv(\.|．|｡|。|․)im|vaza(\.|．|｡|。|․)me|vbly(\.|．|｡|。|․)us|vd55(\.|．|｡|。|․)com|verd(\.|．|｡|。|․)in|vgn(\.|．|｡|。|․)me|vov(\.|．|｡|。|․)li|vsll(\.|．|｡|。|․)eu|vt802(\.|．|｡|。|․)us|vur(\.|．|｡|。|․)me|vv(\.|．|｡|。|․)vg|w1p(\.|．|｡|。|․)fr|waa(\.|．|｡|。|․)ai|wapo(\.|．|｡|。|․)st|wb1(\.|．|｡|。|․)eu|web99(\.|．|｡|。|․)eu|wed(\.|．|｡|。|․)li|wideo(\.|．|｡|。|․)fr|wn(\.|．|｡|。|․)nr|wp(\.|．|｡|。|․)me|wtc(\.|．|｡|。|․)la|wu(\.|．|｡|。|․)cz|ww7(\.|．|｡|。|․)fr|wwy(\.|．|｡|。|․)me|x(\.|．|｡|。|․)nu|x10(\.|．|｡|。|․)mx|x2c(\.|．|｡|。|․)eu|x2c(\.|．|｡|。|․)eumx|xav(\.|．|｡|。|․)cc|xgd(\.|．|｡|。|․)in|xib(\.|．|｡|。|․)me|xl8(\.|．|｡|。|․)eu|xoe(\.|．|｡|。|․)cz|xrl(\.|．|｡|。|․)us|xt3(\.|．|｡|。|․)me|xua(\.|．|｡|。|․)me|xub(\.|．|｡|。|․)me|xurls(\.|．|｡|。|․)co|yagoa(\.|．|｡|。|․)fr|yagoa(\.|．|｡|。|․)me|yau(\.|．|｡|。|․)sh|yeca(\.|．|｡|。|․)eu|yect(\.|．|｡|。|․)com|yep(\.|．|｡|。|․)it|yogh(\.|．|｡|。|․)me|yon(\.|．|｡|。|․)ir|youfap(\.|．|｡|。|․)me|ysear(\.|．|｡|。|․)ch|yyv(\.|．|｡|。|․)co|z9(\.|．|｡|。|․)fr|zSMS(\.|．|｡|。|․)net|zapit(\.|．|｡|。|․)nu|zeek(\.|．|｡|。|․)ir|zip(\.|．|｡|。|․)net|zkr(\.|．|｡|。|․)cz|zkrat(\.|．|｡|。|․)me|zkrt(\.|．|｡|。|․)cz|zoodl(\.|．|｡|。|․)com|zpag(\.|．|｡|。|․)es|zti(\.|．|｡|。|․)me|zxq(\.|．|｡|。|․)net|zyva(\.|．|｡|。|․)org|zzb(\.|．|｡|。|․)bz|sc(\.|．|｡|。|․)link|shorturl(\.|．|｡|。|․)at|kitt(\.|．|｡|。|․)it|00m(\.|．|｡|。|․)in|discord(\.|．|｡|。|․)tokyo|dsc(\.|．|｡|。|․)gg|ooooooooooooooooooooooo(\.|．|｡|。|․)ooo|urlc(\.|．|｡|。|․)net|dsc(\.|．|｡|。|․)gg|dis(\.|．|｡|。|․)gg|dc(\.|．|｡|。|․)gg|i(\.|．|｡|。|․)gg|t(\.|．|｡|。|․)me|dcd(\.|．|｡|。|․)gg|aozora(\.|．|｡|。|․)hosted(\.|．|｡|。|․)click|[^\s]{4,}(\.|．|｡|。|․)glitch(\.|．|｡|。|․)me)/i,
  token: /([A-Za-z0-9]{23,40}\.[A-Za-z0-9]{5,10}\.[A-Za-z0-9\-]{20,40})/,
  mention: /((\@everyone)|(\@here)|(\<\@\$[0-9]{1,}\>)|(\<\@\&[0-9]{1,}\>))/,
  bot_invite_link: /discord(app)?(\.|．|｡|。|․)com[^\s]{1,}((discovery[^\s]{1,}applications[^\s]{1,}[0-9]{1,})|(oauth2[^\s]{1,}authorize\?client\_id\=[^\s]*))/i,
  danger_site: /(https?:\\?\/\\?\/((rinu(\.|．|｡|。|․)jp)|(torproject(\.|．|｡|。|․)uk)|(l(\.|．|｡|。|․)wl(\.|．|｡|。|․)co)))/i,
  spoiler_spam: /\|{4,}/,
  command_link: /https?:\\?\/[^\s]*<\/[^\s]{1,}:[0-9]{1,}>/i,
  ligature_link: /https?:\\?\/\\?\/([^\s]*)?(🅪|🅫|🅬|㏔|🆐|ﬀ|ﬁ|ﬂ|ﬃ|ﬄ|ﬅ|ﬆ|🅊|🅋|🅌|🅍|🅎|🅏|™|℠|Ǉ|ǈ|ǉ|Ǌ|ǋ|ǌ|Ǳ|ǲ|ǳ|℻|Ⅰ|Ⅱ|Ⅲ|Ⅳ|Ⅴ|Ⅵ|Ⅶ|Ⅷ|Ⅸ|Ⅹ|Ⅺ|Ⅻ|Ⅼ|Ⅽ|Ⅾ|Ⅿ|ⅰ|ⅱ|ⅲ|ⅳ|ⅴ|ⅵ|ⅶ|ⅷ|ⅸ|ⅹ|ⅺ|ⅻ|ⅼ|ⅽ|ⅾ|ⅿ|㋌|㋍|㋎|㋏|㍱|㍲|㍳|㍴|㍵|㍶|㍷|㍸|㍹|㍺|㎀|㎁|㎃|㎄|㎅|㎆|㎇|㎈|㎉|㎊|㎋|㎎|㎏|㎐|㎑|㎒|㎓|㎔|㎖|㎗|㎘|㎙|㎚|㎜|㎝|㎞|㎟|㎠|㎡|㎢|㎣|㎤|㎥|㎦|㎩|㎪|㎫|㎬|㎭|㎰|㎱|㎳|㎴|㎵|㎷|㎸|㎹|㎺|㎻|㎽|㎾|㎿|㏃|㏄|㏅|㏈|㏉|㏊|㏋|㏌|㏍|㏎|㏏|㏐|㏑|㏒|㏓|㏔|㏕|㏖|㏗|㏙|㏚|㏛|㏜|㏝|㏿|₨|⒜|⒝|⒞|⒟|⒠|⒡|⒢|⒣|⒤|⒥|⒦|⒧|⒨|⒩|⒪|⒫|⒬|⒭|⒮|⒯|⒰|⒱|⒲|⒳|⒴|⒵|🄐|🄑|🄒|🄓|🄔|🄕|🄖|🄗|🄘|🄙|🄚|🄛|🄜|🄝|🄞|🄟|🄠|🄡|🄢|🄣|🄤|🄥|🄦|🄧|🄨|🄩|🄁|🄂|🄃|🄄|🄅|🄆|🄇|🄈|🄉|🄊|🄭|🄮|🄫|🄬)/,
  steam: /\[(.*?steamcommunity\.com.*?)\]\((https?:\/\/[^\s\)]+)\)/i,
  markdown: /(\[[^\s]{1}\]\(https?:\/\/[^\s]{1,}\)){5,}/i,
  image_spam: /((([^\s]{1,}images\-ext\-[0-9]|cdn|media)(\.|．|｡|。|․)discord(app)?(\.|．|｡|。|․)(com|net)[^\s]{1,}attachments[^\s]{1,}( )*[\n]*)|([^\s]{1,}imgur(\.|．|｡|。|․)com[^\s]{1,}( )*[\n]*)|([^\s]{1,}tenor(\.|．|｡|。|․)com[^\s]{1,}( )*[\n]*)|([^\s]{1,}giphy(\.|．|｡|。|․)com[^\s]{1,}( )*[\n]*)){3,}/i,
  image_site: /(imgur(\.|．|｡|。|․)com|tenor(\.|．|｡|。|․)com|giphy(\.|．|｡|。|․)com)/i,
  uuid: /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i,
  mail: /\b[a-zA-Z0-9_+-]+(\.[a-zA-Z0-9_+-]+)*@[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)*\.[a-zA-Z]{2,}\b/,
  zalgo: /[\u0300-\u036F]{5,}/,
  nsfw_content: /(愛撫|アクメ|アナル|アヌス|イラマチオ|淫乱|エクスタシー|オナニー|自慰|包茎|ガマン汁|顔面騎乗|亀頭|亀甲縛り|くぱぁ|クンニ|コンドーム|ザーメン|Gスポット|四十八手|スカトロ|スパンキング|スワッピング|前戯|センズリ|潜望鏡|前立腺|早漏|祖チン|だいしゅきホールド|ダッチワイフ|ちんぐり返し|ディルド|電マ|童貞|オーガズム|中折れ|繩師|尿道プレイ|ヌーディストビーチ|寝取られ|パイパン|バキュームフェラ|バラ鞭|筆下ろし|踏みつけプレイ|ペッティング|ポルチオ|ペニス|フェラチオ|みこすり半|夢精|ムラムラ期|ヤリチン|ヤリマン|夜這い|ラブジュース|ローション|イラマチオ|膣|顔射|射精|おっぱい|オッパイ|爆乳|長乳|巨乳|貧乳|ちんこ|まんこ|マンコ|ちんぽ|ちんちん|口内射精|肛内射精|胸射|潮吹き|強姦|獣姦|セックス|せっくす|sex|近親相姦)/i,
  gore_content: /(馬鹿|死|4ね|闇バイト)/i,
  super_special_character: /[^\s^\p{Emoji}^\p{Extended_Pictographic}^\p{Script=Hangul}]{1,}([\u0001-\u0009]|[\u0010-\u0019]|\u000b|\u000c|\u000e|\u000f|\u00ad|\u034f|\u00ad|\u061c|\u115f|\u1160|\u17b4|\u17b5|[\u180b-\u180f]|\u205f|[\u200a-\u200f]|[\u202a-\u202f]|\u3164|[\ufe00-\ufe09]|[\ufe0a-\ufe0f]|\ufeff|\uffa0|[\ufff0-\ufff8]|\ud834[\udd73-\udd79]|\ud834\udd7a|\udb40[\udc00-\udfff]|\udb41[\udc00-\udfff]|\udb42[\udc00-\udfff]|\udb43[\udc00-\udfff]){1,}/gu,
  blank_only: /((^([\u0001-\u0009]|[\u0010-\u0019]|\u000b|\u000c|\u000e|\u000f|\u00ad|\u034f|\u00ad|\u061c|\u115f|\u1160|\u17b4|\u17b5|[\u180b-\u180f]|\u205f|[\u200a-\u200f]|[\u202a-\u202f]|\u3164|[\ufe00-\ufe09]|[\ufe0a-\ufe0f]|\ufeff|\uffa0|[\ufff0-\ufff8]|\ud834[\udd73-\udd79]|\ud834\udd7a|\udb40[\udc00-\udfff]|\udb41[\udc00-\udfff]|\udb42[\udc00-\udfff]|\udb43[\udc00-\udfff])+$)|(\|{20,}[^\s]{1,}))/gu,
  kairun_invite: /(https?:\/\/)?kairun(\.|．|｡|。|․)jp[^\s]{1,}Discord[^\s]{1,}invite\?id\=[^\s]{1,}/i,
};

const imageExts = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.avif', '.svg', '.PNG', '.JPG', '.JPEG', '.GIF', '.WEBP', '.BMP', '.AVIF', '.SVG'];
const videoExts = ['.mov', '.mp4', '.mpeg', '.mpg', '.MOV', '.MP4', '.MPEG', '.MPG'];
const textExts = ['.txt', '.json', '.js', '.py', '.html', '.htm', '.css', '.php', '.md', '.ts', '.mjs', '.ejs', '.TXT', '.JSON', '.JS', '.PY', '.HTML', '.HTM', '.CSS', '.PHP', '.MD', '.TS', '.MJS', '.EJS'];

const bypassUserIds = new Set([
  "1350156436562514043",
  "1140963618423312436",
  "1435610137548292187",
  "850493201064132659",
  "302050872383242240",
  "761562078095867916",
  "1233072112139501608",
  "903541413298450462",
  "935855687400054814"
]);

const messageHistory = new Map();
const actionHistory = new Map();

async function cleanupFiles(tempFile, framesDir) {
  try {
    if (tempFile && (await fs.stat(tempFile).catch(() => null))) {
      await fs.unlink(tempFile);
      console.log(`Deleted temporary file: ${tempFile}`);
    }
  } catch (err) {
    console.error(`Error deleting temporary file ${tempFile}:`, err);
  }
  try {
    if (framesDir && (await fs.stat(framesDir).catch(() => null))) {
      await fs.rm(framesDir, { recursive: true, force: true });
      console.log(`Deleted temporary frames directory: ${framesDir}`);
    }
  } catch (err) {
    console.error(`Error deleting frames directory ${framesDir}:`, err);
  }
}

async function cleanupOldFiles() {
  const tempDir = process.env.HOME || '/tmp';
  try {
    const files = await fs.readdir(tempDir);
    for (const file of files) {
      if (file.startsWith('temp_') || file.startsWith('frames_')) {
        const filePath = path.join(tempDir, file);
        const stats = await fs.stat(filePath).catch(() => null);
        if (stats && Date.now() - stats.mtimeMs > 24 * 60 * 60 * 1000) {
          if (stats.isFile()) {
            await fs.unlink(filePath);
            console.log(`Deleted old temporary file: ${filePath}`);
          } else if (stats.isDirectory()) {
            await fs.rm(filePath, { recursive: true, force: true });
            console.log(`Deleted old temporary directory: ${filePath}`);
          }
        }
      }
    }
  } catch (err) {
    console.error('Error during old files cleanup:', err);
  }
}
setTimeout(cleanupOldFiles, 0);
setInterval(cleanupOldFiles, 60 * 60 * 1000);

async function processMessage(message, isUpdate = false, oldMessage = null) {
  let commandUser = null;
  if (message.interactionMetadata) {
    try {
      commandUser = message.interactionMetadata.user;
    } catch (err) {
      console.error('Error checking interaction:', err);
    }
  }

  if (bypassUserIds.has(message.author.id)) return;
  if (message.system || message.author.id === message.guild.ownerId) return;

  const guildId = message.guildId;
  const settingsPath = path.join(process.cwd(), 'settings', `${guildId}.json`);
  let settings;
  try {
    settings = JSON.parse(await fs.readFile(settingsPath, 'utf8'));
  } catch (err) {
    return;
  }

  if (settings.notBot?.enabled && message.author.bot) return;
  if (settings.notAdmin?.enabled && message.member?.permissions.has('Administrator')) return;
  
  settings.whitelist = {
  channels: Array.isArray(settings.whitelist?.channels) ? settings.whitelist.channels : [],
  categories: Array.isArray(settings.whitelist?.categories) ? settings.whitelist.categories : [],
  roles: Array.isArray(settings.whitelist?.roles) ? settings.whitelist.roles : [],
  members: Array.isArray(settings.whitelist?.members) ? settings.whitelist.members : []
  };

  settings.ruleWhitelist = settings.ruleWhitelist ?? {};

  settings.antiTroll = settings.antiTroll ?? {
  enabled: false,
  rules: {
    invite_link: { enabled: false }
  }
  };
  const guildSettings = settings;
  if (!guildSettings) return;

  const channel = message.channel;
  const isSenderWhitelisted =
  (settings.whitelist.channels ?? []).some((ch) => ch === message.channelId) ||
  (settings.whitelist.categories ?? []).some((cat) => cat === channel.parentId) ||
  message.member?.roles.cache.some((role) => (settings.whitelist.roles ?? []).some((r) => r === role.id)) ||
  (settings.whitelist.members ?? []).some((m) => m === message.author.id);

  let isCommandUserWhitelisted = false;
  if (commandUser) {
  const commandMember = await message.guild.members.fetch(commandUser.id).catch(() => null);
  isCommandUserWhitelisted =
    (settings.whitelist.members ?? []).some((m) => m === commandUser.id) ||
    (commandMember && commandMember.roles.cache.some((role) => (settings.whitelist.roles ?? []).some((r) => r === role.id)));
  }

  if (!guildSettings.antiTroll?.enabled) return;
  let violation = null;
  
  for (const [rule, config] of Object.entries(guildSettings.antiTroll.rules)) {
    if (!config.enabled) continue;

    const ruleWhitelist = settings.ruleWhitelist[rule] ?? {
      channels: [],
      categories: [],
      roles: [],
      members: []
    };
    const isSenderRuleWhitelisted =
      ruleWhitelist.channels.some((ch) => ch === message.channelId) ||
      ruleWhitelist.categories.some((cat) => cat === channel.parentId) ||
      message.member?.roles.cache.some((role) => ruleWhitelist.roles.some((r) => r === role.id)) ||
      ruleWhitelist.members.some((m) => m === message.author.id);

    let isCommandUserRuleWhitelisted = false;
    if (commandUser) {
      const commandMember = await message.guild.members.fetch(commandUser.id).catch(() => null);
      isCommandUserRuleWhitelisted =
        ruleWhitelist.members.some((m) => m === commandUser.id) ||
        (commandMember && commandMember.roles.cache.some((role) => ruleWhitelist.roles.some((r) => r === role.id)));
    }

    if (isSenderRuleWhitelisted || (commandUser && isCommandUserRuleWhitelisted)) {
      continue;
    }

    if (patterns[rule] && patterns[rule].test(message.content)) {
      violation = rule;
      break;
    }
  }

  if (!violation) {
    for (const [rule, config] of Object.entries(guildSettings.antiTroll.rules)) {
      if (!config.enabled) continue;
      if (patterns[rule] && patterns[rule].test(message.content)) {
        violation = rule;
      }
    }
  }

  if (!violation && message.poll) {
    const pollQuestion = message.poll.question?.text;
    if (pollQuestion) {
      for (const [rule, config] of Object.entries(guildSettings.antiTroll.rules)) {
        if (!config.enabled) continue;
        if (patterns[rule] && pollQuestion.match(patterns[rule])) {
          violation = rule;
          break;
        }
      }
    }
    if (!violation && message.poll.answers?.size > 0) {
      const pollAnswers = message.poll.answers.map(answer => answer.poll_media?.text).filter(text => text);
      for (const answerText of pollAnswers) {
        for (const [rule, config] of Object.entries(guildSettings.antiTroll.rules)) {
          if (!config.enabled) continue;
          if (patterns[rule] && answerText.match(patterns[rule])) {
            violation = rule;
            break;
          }
        }
        if (violation) break;
      }
    }
  }
  if (!violation && message.attachments.size > 0) {
    for (const attachment of message.attachments.values()) {
      const filename = attachment.name || '';
      const ext = path.extname(filename).toLowerCase();
      for (const [rule, config] of Object.entries(guildSettings.antiTroll.rules)) {
        if (!config.enabled) continue;
        if (patterns[rule] && filename.match(patterns[rule])) {
          violation = rule;
          console.log(`Violation in attachment filename: ${rule} - ${filename}`);
          break;
        }
      }
      if (violation) break;
      if (imageExts.includes(ext)) {
        try {
          const response = await fetch(attachment.url, { timeout: 5000 });
          if (response.headers.get('content-type')?.startsWith('image/')) {
            if (Number(response.headers.get('content-length')) > 10 * 1024 * 1024) {
              continue;
            }
            const buffer = await response.buffer();
            const { data: { text } } = await Tesseract.recognize(buffer, 'eng', { logger: (m) => console.log(m) });
            for (const [rule, config] of Object.entries(guildSettings.antiTroll.rules)) {
              if (!config.enabled) continue;
              if (patterns[rule] && text.match(patterns[rule])) {
                violation = rule;
                break;
              }
            }
          }
        } catch (err) {
          console.error(`Error processing image ${filename}:`, err);
        }
      }
      if (videoExts.includes(ext)) {
        let tempFile, framesDir;
        try {
          const response = await fetch(attachment.url, { timeout: 5000 });
          if (response.headers.get('content-type')?.startsWith('video/')) {
            if (Number(response.headers.get('content-length')) > 10 * 1024 * 1024) {
              continue;
            }
            const buffer = await response.buffer();
            tempFile = path.join(process.env.HOME || '/tmp', `temp_${Date.now()}${ext}`);
            framesDir = path.join(process.env.HOME || '/tmp', `frames_${Date.now()}`);
            await fs.writeFile(tempFile, buffer);
            await fs.mkdir(framesDir);
            await new Promise((resolve, reject) => {
              ffmpeg(tempFile)
                .setDuration(5)
                .outputOptions(['-vf fps=1'])
                .output(`${framesDir}/frame-%d.png`)
                .on('end', resolve)
                .on('error', reject)
                .run();
            });
            const frameFiles = await fs.readdir(framesDir);
            for (const frame of frameFiles) {
              const { data: { text } } = await Tesseract.recognize(`${framesDir}/${frame}`, 'eng');
              for (const [rule, config] of Object.entries(guildSettings.antiTroll.rules)) {
                if (!config.enabled) continue;
                if (patterns[rule] && text.match(patterns[rule])) {
                  violation = rule;
                  break;
                }
              }
              if (violation) break;
            }
          }
        } catch (err) {
          console.error(`Error processing video ${filename}:`, err);
        } finally {
          await cleanupFiles(tempFile, framesDir);
        }
      }
      if (textExts.includes(ext)) {
        try {
          const response = await fetch(attachment.url, { timeout: 5000 });
          const text = (await response.text()).slice(0, 500);
          for (const [rule, config] of Object.entries(guildSettings.antiTroll.rules)) {
            if (!config.enabled) continue;
            if (patterns[rule] && text.match(patterns[rule])) {
              violation = rule;
              break;
            }
          }
        } catch (err) {
          console.error(`Error processing text file ${filename}:`, err);
        }
      }
      if (violation) break;
    }
  }
  if (!violation && message.embeds.length > 0) {
    for (const embed of message.embeds) {
      for (const [rule, config] of Object.entries(guildSettings.antiTroll.rules)) {
        if (!config.enabled) continue;
        if (patterns[rule]) {
          if (embed.provider?.name && patterns[rule].test(embed.provider.name)) {
            violation = rule;
            break;
          }
          if (embed.provider?.url && patterns[rule].test(embed.provider.url)) {
            violation = rule;
            break;
          }
          if (rule === 'invite_link' && embed.provider?.name === 'Discord') {
            violation = rule;
            break;
          }
          if (
            embed.description?.match(patterns[rule]) ||
            embed.title?.match(patterns[rule]) ||
            embed.url?.match(patterns[rule]) ||
            embed.footer?.text?.match(patterns[rule])
          ) {
            violation = rule;
            break;
          }
          if (embed.fields?.length > 0) {
            for (const field of embed.fields) {
              if (
                (field.name && patterns[rule].test(field.name)) ||
                (field.value && patterns[rule].test(field.value))
              ) {
                violation = rule;
                break;
              }
            }
          }
          if (embed.author && (embed.author.name?.match(patterns[rule]) || embed.author.url?.match(patterns[rule]))) {
            violation = rule;
            break;
          }
        }
        if (violation) break;
      }
      if (!violation && (embed.thumbnail?.url || embed.image?.url)) {
        const imgUrl = embed.thumbnail?.url || embed.image?.url;
        const ext = path.extname(imgUrl || '').toLowerCase();
        if (imageExts.includes(ext)) {
          try {
            const response = await fetch(imgUrl, { timeout: 5000 });
            if (response.headers.get('content-type')?.startsWith('image/')) {
              if (Number(response.headers.get('content-length')) > 10 * 1024 * 1024) {
                continue;
              }
              const buffer = await response.buffer();
              const { data: { text } } = await Tesseract.recognize(buffer, 'eng', { logger: (m) => console.log(m) });
              for (const [rule, config] of Object.entries(guildSettings.antiTroll.rules)) {
                if (!config.enabled) continue;
                if (patterns[rule] && text.match(patterns[rule])) {
                  violation = rule;
                  break;
                }
              }
            }
          } catch (err) {
            console.error(`Error processing embed image ${imgUrl}:`, err);
          }
        }
      }
      if (!violation && embed.video?.url) {
        const ext = path.extname(embed.video.url || '').toLowerCase();
        let tempFile, framesDir;
        if (videoExts.includes(ext)) {
          try {
            const response = await fetch(embed.video.url, { timeout: 5000 });
            if (response.headers.get('content-type')?.startsWith('video/')) {
              if (Number(response.headers.get('content-length')) > 10 * 1024 * 1024) {
                continue;
              }
              const buffer = await response.buffer();
              tempFile = path.join(process.env.HOME || '/tmp', `temp_embed_${Date.now()}${ext || '.mp4'}`);
              framesDir = path.join(process.env.HOME || '/tmp', `frames_embed_${Date.now()}`);
              await fs.writeFile(tempFile, buffer);
              await fs.mkdir(framesDir);
              await new Promise((resolve, reject) => {
                ffmpeg(tempFile)
                  .setDuration(5)
                  .outputOptions(['-vf fps=1'])
                  .output(`${framesDir}/frame-%d.png`)
                  .on('end', resolve)
                  .on('error', reject)
                  .run();
              });
              const frameFiles = await fs.readdir(framesDir);
              for (const frame of frameFiles) {
                const { data: { text } } = await Tesseract.recognize(`${framesDir}/${frame}`, 'eng');
                for (const [rule, config] of Object.entries(guildSettings.antiTroll.rules)) {
                  if (!config.enabled) continue;
                  if (patterns[rule] && text.match(patterns[rule])) {
                    violation = rule;
                    break;
                  }
                }
                if (violation) break;
              }
            }
          } catch (err) {
            console.error(`Error processing embed video ${embed.video.url}:`, err);
          } finally {
            await cleanupFiles(tempFile, framesDir);
          }
        }
      }
      if (violation) break;
    }
  }
  if (!violation && message.messageSnapshots?.size) {
    const snapshot = message.messageSnapshots.first();
    const snapshotContent = snapshot.content || '';
    if (snapshotContent) {
      for (const [rule, config] of Object.entries(guildSettings.antiTroll.rules)) {
        if (!config.enabled) continue;
        if (patterns[rule]?.test(snapshotContent)) {
          violation = rule;
          break;
        }
      }
    }
    if (!violation && snapshot.embeds?.length) {
      for (const embed of snapshot.embeds) {
        for (const [rule, config] of Object.entries(guildSettings.antiTroll.rules)) {
          if (!config.enabled) continue;
          if (patterns[rule]) {
            if (embed.provider?.name && patterns[rule].test(embed.provider.name)) {
              violation = rule;
              break;
            }
            if (embed.provider?.url && patterns[rule].test(embed.provider.url)) {
              violation = rule;
              break;
            }
            if (
              embed.title?.match(patterns[rule]) ||
              embed.description?.match(patterns[rule]) ||
              embed.url?.match(patterns[rule]) ||
              embed.footer?.text?.match(patterns[rule])
            ) {
              violation = rule;
              break;
            }
            if (embed.fields?.length > 0) {
              for (const field of embed.fields) {
                if (
                  (field.name && patterns[rule].test(field.name)) ||
                  (field.value && patterns[rule].test(field.value))
                ) {
                  violation = rule;
                  break;
                }
              }
            }
            if (embed.author && (embed.author.name?.match(patterns[rule]) || embed.author.url?.match(patterns[rule]))) {
              violation = rule;
              break;
            }
          }
          if (violation) break;
        }
        if (!violation && (embed.thumbnail?.url || embed.image?.url)) {
          const imgUrl = embed.thumbnail?.url || embed.image?.url;
          const ext = path.extname(imgUrl || '').toLowerCase();
          if (imageExts.includes(ext)) {
            try {
              const response = await fetch(imgUrl, { timeout: 5000 });
              if (response.headers.get('content-type')?.startsWith('image/')) {
                if (Number(response.headers.get('content-length')) > 10 * 1024 * 1024) {
                  continue;
                }
                const buffer = await response.buffer();
                const { data: { text } } = await Tesseract.recognize(buffer, 'eng', { logger: (m) => console.log(m) });
                for (const [rule, config] of Object.entries(guildSettings.antiTroll.rules)) {
                  if (!config.enabled) continue;
                  if (patterns[rule] && text.match(patterns[rule])) {
                    violation = rule;
                    break;
                  }
                }
              }
            } catch (err) {
              console.error(`Error processing snapshot embed image ${imgUrl}:`, err);
            }
          }
        }
        if (!violation && embed.video?.url) {
          const ext = path.extname(embed.video.url || '').toLowerCase();
          let tempFile, framesDir;
          if (videoExts.includes(ext)) {
            try {
              const response = await fetch(embed.video.url, { timeout: 5000 });
              if (response.headers.get('content-type')?.startsWith('video/')) {
                if (Number(response.headers.get('content-length')) > 10 * 1024 * 1024) {
                  continue;
                }
                const buffer = await response.buffer();
                tempFile = path.join(process.env.HOME || '/tmp', `temp_snap_${Date.now()}${ext || '.mp4'}`);
                framesDir = path.join(process.env.HOME || '/tmp', `frames_snap_${Date.now()}`);
                await fs.writeFile(tempFile, buffer);
                await fs.mkdir(framesDir);
                await new Promise((resolve, reject) => {
                  ffmpeg(tempFile)
                    .setDuration(5)
                    .outputOptions(['-vf fps=1'])
                    .output(`${framesDir}/frame-%d.png`)
                    .on('end', resolve)
                    .on('error', reject)
                    .run();
                });
                const frameFiles = await fs.readdir(framesDir);
                for (const frame of frameFiles) {
                  const { data: { text } } = await Tesseract.recognize(`${framesDir}/${frame}`, 'eng');
                  for (const [rule, config] of Object.entries(guildSettings.antiTroll.rules)) {
                    if (!config.enabled) continue;
                    if (patterns[rule] && text.match(patterns[rule])) {
                      violation = rule;
                      break;
                    }
                  }
                  if (violation) break;
                }
              }
            } catch (err) {
              console.error(`Error processing snapshot embed video ${embed.video.url}:`, err);
            } finally {
              await cleanupFiles(tempFile, framesDir);
            }
          }
        }
        if (violation) break;
      }
    }
    if (!violation && snapshot.attachments?.size > 0) {
      for (const attachment of snapshot.attachments.values()) {
        const filename = attachment.name || '';
        const ext = path.extname(filename).toLowerCase();
        for (const [rule, config] of Object.entries(guildSettings.antiTroll.rules)) {
          if (!config.enabled) continue;
          if (patterns[rule] && filename.match(patterns[rule])) {
            violation = rule;
            break;
          }
        }
        if (violation) break;
        if (imageExts.includes(ext)) {
          try {
            const response = await fetch(attachment.url, { timeout: 5000 });
            if (response.headers.get('content-type')?.startsWith('image/')) {
              if (Number(response.headers.get('content-length')) > 10 * 1024 * 1024) {
                continue;
              }
              const buffer = await response.buffer();
              const { data: { text } } = await Tesseract.recognize(buffer, 'eng', { logger: (m) => console.log(m) });
              for (const [rule, config] of Object.entries(guildSettings.antiTroll.rules)) {
                if (!config.enabled) continue;
                if (patterns[rule] && text.match(patterns[rule])) {
                  violation = rule;
                  break;
                }
              }
            }
          } catch (err) {
            console.error(`Error processing snapshot image ${filename}:`, err);
          }
        }
        if (videoExts.includes(ext)) {
          let tempFile, framesDir;
          try {
            const response = await fetch(attachment.url, { timeout: 5000 });
            if (response.headers.get('content-type')?.startsWith('video/')) {
              if (Number(response.headers.get('content-length')) > 10 * 1024 * 1024) {
                continue;
              }
              const buffer = await response.buffer();
              tempFile = path.join(process.env.HOME || '/tmp', `temp_snap_${Date.now()}${ext}`);
              framesDir = path.join(process.env.HOME || '/tmp', `frames_snap_${Date.now()}`);
              await fs.writeFile(tempFile, buffer);
              await fs.mkdir(framesDir);
              await new Promise((resolve, reject) => {
                ffmpeg(tempFile)
                  .setDuration(5)
                  .outputOptions(['-vf fps=1'])
                  .output(`${framesDir}/frame-%d.png`)
                  .on('end', resolve)
                  .on('error', reject)
                  .run();
              });
              const frameFiles = await fs.readdir(framesDir);
              for (const frame of frameFiles) {
                const { data: { text } } = await Tesseract.recognize(`${framesDir}/${frame}`, 'eng');
                for (const [rule, config] of Object.entries(guildSettings.antiTroll.rules)) {
                  if (!config.enabled) continue;
                  if (patterns[rule] && text.match(patterns[rule])) {
                    violation = rule;
                    break;
                  }
                }
                if (violation) break;
              }
            }
          } catch (err) {
            console.error(`Error processing snapshot video ${filename}:`, err);
          } finally {
            await cleanupFiles(tempFile, framesDir);
          }
        }
        if (textExts.includes(ext)) {
          try {
            const response = await fetch(attachment.url, { timeout: 5000 });
            const text = (await response.text()).slice(0, 500);
            for (const [rule, config] of Object.entries(guildSettings.antiTroll.rules)) {
              if (!config.enabled) continue;
              if (patterns[rule] && text.match(patterns[rule])) {
                violation = rule;
                break;
              }
            }
          } catch (err) {
            console.error(`Error processing snapshot text file ${filename}:`, err);
          }
        }
        if (violation) break;
      }
    }
  }

  if (message.components?.length > 0) {
    for (const actionRow of message.components) {
      if (!actionRow.components || !Array.isArray(actionRow.components)) {
        continue;
      }
      for (const component of actionRow.components) {
        const textFields = [];
        if (component.type === 2) {
          if (component.label) textFields.push({ field: 'button label', value: component.label });
          if (component.custom_id) textFields.push({ field: 'button customId', value: component.custom_id });
          if (component.url) textFields.push({ field: 'button URL', value: component.url });
        }
        if (component.type === 3) {
          if (component.custom_id) textFields.push({ field: 'select menu customId', value: component.custom_id });
          if (component.placeholder) textFields.push({ field: 'select menu placeholder', value: component.placeholder });
          for (const option of component.options || []) {
            if (option.label) textFields.push({ field: 'select menu option label', value: option.label });
            if (option.description) textFields.push({ field: 'select menu option description', value: option.description });
            if (option.value) textFields.push({ field: 'select menu option value', value: option.value });
          }
        }
        if (component.type === 4) {
          if (component.custom_id) textFields.push({ field: 'text input customId', value: component.custom_id });
          if (component.label) textFields.push({ field: 'text input label', value: component.label });
          if (component.placeholder) textFields.push({ field: 'text input placeholder', value: component.placeholder });
          if (component.value) textFields.push({ field: 'text input value', value: component.value });
        }
        if (component.type === 5) {
          if (component.custom_id) textFields.push({ field: 'user select customId', value: component.custom_id });
          if (component.placeholder) textFields.push({ field: 'user select placeholder', value: component.placeholder });
        }
        if (component.type === 6) {
          if (component.custom_id) textFields.push({ field: 'role select customId', value: component.custom_id });
          if (component.placeholder) textFields.push({ field: 'role select placeholder', value: component.placeholder });
        }
        if (component.type === 7) {
          if (component.custom_id) textFields.push({ field: 'mentionable select customId', value: component.custom_id });
          if (component.placeholder) textFields.push({ field: 'mentionable select placeholder', value: component.placeholder });
        }
        if (component.type === 8) {
          if (component.custom_id) textFields.push({ field: 'channel select customId', value: component.custom_id });
          if (component.placeholder) textFields.push({ field: 'channel select placeholder', value: component.placeholder });
        }
        if (component.type === 9) {
          if (component.custom_id) textFields.push({ field: 'section customId', value: component.custom_id });
          if (component.title) textFields.push({ field: 'section title', value: component.title });
          if (component.accessory) {
            if (component.accessory.description) textFields.push({ field: 'section accessory description', value: component.accessory.description });
            if (component.accessory.url) textFields.push({ field: 'section accessory URL', value: component.accessory.url });
          }
          if (component.components) {
            for (const subComponent of component.components) {
              if (subComponent.content) textFields.push({ field: 'section subcomponent content', value: subComponent.content });
              if (subComponent.custom_id) textFields.push({ field: 'section subcomponent customId', value: subComponent.custom_id });
            }
          }
        }
        if (component.type === 10) {
          if (component.custom_id) textFields.push({ field: 'text display customId', value: component.custom_id });
          if (component.content) textFields.push({ field: 'text display content', value: component.content });
        }
        if (component.type === 11) {
          if (component.custom_id) textFields.push({ field: 'thumbnail customId', value: component.custom_id });
          if (component.description) textFields.push({ field: 'thumbnail description', value: component.description });
          if (component.url) textFields.push({ field: 'thumbnail URL', value: component.url });
        }
        if (component.type === 12) {
          if (component.custom_id) textFields.push({ field: 'media gallery customId', value: component.custom_id });
          for (const item of component.items || []) {
            if (item.description) textFields.push({ field: 'media gallery item description', value: item.description });
            if (item.url) textFields.push({ field: 'media gallery item URL', value: item.url });
          }
        }
        if (component.type === 13) {
          if (component.custom_id) textFields.push({ field: 'file customId', value: component.custom_id });
          if (component.url) textFields.push({ field: 'file URL', value: component.url });
        }
        if (component.type === 14) {
          if (component.custom_id) textFields.push({ field: 'separator customId', value: component.custom_id });
        }
        if (component.type === 17) {
          if (component.custom_id) textFields.push({ field: 'container customId', value: component.custom_id });
          if (component.components) {
            for (const subComponent of component.components) {
              if (subComponent.content) textFields.push({ field: 'container subcomponent content', value: subComponent.content });
              if (subComponent.custom_id) textFields.push({ field: 'container subcomponent customId', value: subComponent.custom_id });
              if (subComponent.description) textFields.push({ field: 'container subcomponent description', value: subComponent.description });
              if (subComponent.url) textFields.push({ field: 'container subcomponent URL', value: subComponent.url });
            }
          }
        }
        for (const { field, value } of textFields) {
          for (const [rule, config] of Object.entries(guildSettings.antiTroll.rules)) {
            if (!config.enabled) continue;
            if (patterns[rule] && value.match(patterns[rule])) {
              violation = rule;
              break;
            }
          }
          if (violation) break;
        }
        if (violation) break;
      }
      if (violation) break;
    }
  }

  if (violation) {
    if (!isSenderWhitelisted || (commandUser && !isCommandUserWhitelisted)) {
      await handleViolation(
        message,
        violation,
        guildSettings,
        isUpdate,
        commandUser && !isCommandUserWhitelisted ? commandUser : null
      );
    }
  }
}

export async function execute(message) {
  await processMessage(message, false);
}

export async function executeUpdate(oldMessage, newMessage) {
  if (newMessage.partial) {
    try {
      newMessage = await newMessage.fetch();
    } catch (err) {
      console.error('Error fetching updated message:', err);
      return;
    }
  }
  await processMessage(newMessage, true, oldMessage);
}

function similarity(s1, s2) {
  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;
  const longerLength = longer.length;
  if (longerLength === 0) return 1.0;
  return (longerLength - editDistance(longer, shorter)) / longerLength;
}

function editDistance(s1, s2) {
  const costs = new Array(s2.length + 1).fill(0);
  for (let i = 0; i <= s1.length; i++) {
    let lastValue = i;
    for (let j = 0; j <= s2.length; j++) {
      if (i === 0) costs[j] = j;
      else if (j > 0) {
        let newValue = costs[j - 1];
        if (s1[i - 1] !== s2[j - 1])
          newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
        costs[j - 1] = lastValue;
        lastValue = newValue;
      }
    }
    if (i > 0) costs[s2.length] = lastValue;
  }
  return costs[s2.length];
}

async function handleViolation(message, rule, settings, isUpdate = false, commandUser = null) {
  const points = settings.points[rule] || 1;
  const guildId = message.guildId;
  const pointsPath = path.join(process.cwd(), 'points', `${guildId}.json`);
  const targetUsers = [];
  const isBotSender = message.author.bot;
  const isBotBypassed = isBotSender && bypassUserIds.has(message.author.id);
  if (!bypassUserIds.has(message.author.id)) {
    targetUsers.push({ id: message.author.id, tag: message.author.tag, member: message.member });
  }
  if (commandUser && !bypassUserIds.has(commandUser.id)) {
    const commandMember = await message.guild.members.fetch(commandUser.id).catch(() => null);
    if (commandMember) {
      targetUsers.push({ id: commandUser.id, tag: commandUser.tag, member: commandMember });
    }
  }
  let pointsData;
  try {
    pointsData = JSON.parse(await fs.readFile(pointsPath, 'utf8'));
  } catch (err) {
    pointsData = {};
    try {
      await fs.writeFile(pointsPath, JSON.stringify(pointsData, null, 2));
    } catch (writeErr) {
      return;
    }
  }
  if (!pointsData[guildId]) pointsData[guildId] = {};
  const userPunishments = new Map();
  for (const user of targetUsers) {
    if (!pointsData[guildId][user.id]) pointsData[guildId][user.id] = { points: 0, lastViolation: null };
    pointsData[guildId][user.id].points += points;
    pointsData[guildId][user.id].lastViolation = Date.now();
    const totalPoints = pointsData[guildId][user.id].points;
    const thresholds = settings.points.thresholds || { '10': 'timeout', '15': 'delete_webhook', '20': 'kick', '30': 'ban' };
    let punishment = null;
    for (const [point, action] of Object.entries(thresholds)) {
      if (totalPoints >= parseInt(point)) punishment = action;
    }
    if (settings.block.enabled && punishment && user.member) {
      try {
        if (punishment === 'timeout') {
          await user.member.timeout(settings.block.timeout || 600000, `Violation: ${rule}`);
        } else if (punishment === 'kick') {
          await user.member.kick(`Violation: ${rule}`);
        } else if (punishment === 'ban') {
          await message.guild.members.ban(user.id, { reason: `Violation: ${rule}` });
        } else if (punishment === 'delete_webhook' && message.webhookId) {
        const webhookId = message.webhookId;
        let webhook = null;

        try {
          const channelHooks = await message.channel.fetchWebhooks();
          webhook = channelHooks.find(w => w.id === webhookId);
        } catch { }

        if (!webhook) {
          try {
            const guildHooks = await message.guild.fetchWebhooks();
            webhook = guildHooks.find(w => w.id === webhookId);
          } catch { }
        }

        if (webhook) {
          await webhook.delete(`Anti-Troll: Webhook violated rule "${rule}" (${totalPoints}pts)`);
        }
      }
      } catch (err) {}
    }
    userPunishments.set(user.id, punishment);
  }
  try {
    await fs.writeFile(pointsPath, JSON.stringify(pointsData, null, 2));
  } catch (err) {
    return;
  }
  let messageDeleted = false;
  const messageContent =  message.content || "埋め込み・転送・コンポーネント・画像内文字などが検知された可能性があります。";
    if (settings.logWebhook) {
      const embed = new EmbedBuilder()
        .setTitle(`Anti-Troll Violation (${isUpdate ? 'Message Update' : 'Message Create'})`)
        .setDescription(
          `**User**: ${message.author.tag} (${message.author.id})\n` +
          (commandUser ? `**Command User**: ${commandUser.tag} (${commandUser.id})\n` : '') +
          `**Rule**: ${rule}\n` +
          `**Points**: ${pointsData[guildId][message.author.id]?.points || 0}\n` +
          (commandUser ? `**Command User Points**: ${pointsData[guildId][commandUser.id]?.points || 0}\n` : '') +
          `**Punishment**: ${targetUsers
            .map((u) => (u.member && userPunishments.get(u.id) ? userPunishments.get(u.id) : 'None'))
            .join(', ')}\n` +
          `**Message Deleted**: ${isBotBypassed ? 'No (Bot Bypassed)' : commandUser && bypassUserIds.has(commandUser.id) ? 'No (Executor Bypassed)' : 'Yes'}` +
          `**Message**: ${messageContent}`
        )
        .setTimestamp();
      try {
        await axios.post(settings.logWebhook, { embeds: [embed.toJSON()] }).catch(() => {});
      } catch (err) {
    }
  }
  if (webhookUrl) {
    const embed = new EmbedBuilder()
      .setTitle(`Anti-Troll Violation from ${message.guild.name} (${isUpdate ? 'Message Update' : 'Message Create'})`)
      .setDescription(
        `**Server**: ${message.guild.name} (${message.guildId})\n` +
        `**Channel**: ${message.channel.name} (${message.channelId})\n` +
        `**User**: ${message.author.tag} (${message.author.id})\n` +
        (commandUser ? `**Command User**: ${commandUser.tag} (${commandUser.id})\n` : '') +
        `**Rule**: ${rule}\n` +
        `**Points**: ${pointsData[guildId][message.author.id]?.points || 0}\n` +
        (commandUser ? `**Command User Points**: ${pointsData[guildId][commandUser.id]?.points || 0}\n` : '') +
        `**Punishment**: ${targetUsers
          .map((u) => (u.member && userPunishments.get(u.id) ? userPunishments.get(u.id) : 'None'))
          .join(', ')}\n` +
        `**Message Deleted**: ${isBotBypassed ? 'No (Bot Bypassed)' : commandUser && bypassUserIds.has(commandUser.id) ? 'No (Executor Bypassed)' : 'Yes'}\n` +
        `**Message**: ${messageContent}`
      )
      .setTimestamp();
    try {
      await axios.post(webhookUrl, {
        embeds: [embed.toJSON()]
      });
    } catch (err) {}
  } else {}
  if (!isBotBypassed && !(commandUser && bypassUserIds.has(commandUser.id))) {
    try {
      await message.delete();
      messageDeleted = true;
    } catch (err) {}
  }
}

const MAP_CLEANUP_INTERVAL = 60 * 60 * 1000;
const MAP_ENTRY_TTL = 60 * 60 * 1000;
async function cleanupMaps() {
  const now = Date.now();
  for (const [key, value] of messageHistory.entries()) {
    if (value.timestamp && now - value.timestamp > MAP_ENTRY_TTL) {
      messageHistory.delete(key);
    }
  }
  for (const [key, value] of actionHistory.entries()) {
    if (value.timestamp && now - value.timestamp > MAP_ENTRY_TTL) {
      actionHistory.delete(key);
    }
  }
  console.log(`Map cleanup completed.`);
}
setTimeout(cleanupMaps, MAP_CLEANUP_INTERVAL);
setInterval(cleanupMaps, MAP_CLEANUP_INTERVAL);