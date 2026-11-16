# Guide pages: one page per common search ("qubic explorer"...), built from the map data. Run by build.py
# (exec, with its globals: E, LG, HL, TR, t, slug, esc, wr, URL). Writes public/<page>.html and public/<lang>/<page>.html.
# Texts: GT[english] = [fr, es, zh, nl, ru, de]. Project descriptions come from the map translations (TR).
import json as _json

GT = {
 "Qubic explorers: compare block explorers and network tools": ["Explorateurs Qubic : comparez les explorateurs de blocs et les outils réseau", "Exploradores de Qubic: compara exploradores de bloques y herramientas de red", "Qubic 区块浏览器：比较区块浏览器和网络工具", "Qubic-explorers: vergelijk block explorers en netwerktools", "Обозреватели Qubic: сравнение блок-эксплореров и сетевых инструментов", "Qubic-Explorer: Block-Explorer und Netzwerk-Tools im Vergleich"],
 "Look up Qubic addresses, transactions, ticks and epochs. Compare the official Qubic Explorer, Qubic Report and live network tools side by side.": ["Consultez les adresses, transactions, ticks et époques de Qubic. Comparez le Qubic Explorer officiel, Qubic Report et les outils réseau en direct.", "Consulta direcciones, transacciones, ticks y épocas de Qubic. Compara el Qubic Explorer oficial, Qubic Report y las herramientas de red en directo.", "查询 Qubic 的地址、交易、tick 和纪元。并排比较官方 Qubic Explorer、Qubic Report 以及实时网络工具。", "Bekijk adressen, transacties, ticks en epochs van Qubic. Vergelijk de officiële Qubic Explorer, Qubic Report en live netwerktools naast elkaar.", "Смотрите адреса, транзакции, тики и эпохи Qubic. Сравните официальный Qubic Explorer, Qubic Report и сетевые инструменты в реальном времени.", "Adressen, Transaktionen, Ticks und Epochen von Qubic nachschlagen. Der offizielle Qubic Explorer, Qubic Report und Live-Netzwerk-Tools im direkten Vergleich."],
 "Qubic explorers": ["Explorateurs Qubic", "Exploradores de Qubic", "Qubic 区块浏览器", "Qubic-explorers", "Обозреватели Qubic", "Qubic-Explorer"],
 "Tools to look up addresses, transactions, ticks and epochs on the Qubic network. All are listed on QubicMap; each links to its project page and to the tool itself.": ["Des outils pour consulter les adresses, transactions, ticks et époques du réseau Qubic. Tous sont référencés sur QubicMap ; chacun renvoie à sa fiche projet et à l'outil lui-même.", "Herramientas para consultar direcciones, transacciones, ticks y épocas de la red Qubic. Todas figuran en QubicMap; cada una enlaza a su página de proyecto y a la propia herramienta.", "用于查询 Qubic 网络地址、交易、tick 和纪元的工具。它们都收录在 QubicMap 上，每个都链接到其项目页面和工具本身。", "Tools om adressen, transacties, ticks en epochs op het Qubic-netwerk op te zoeken. Ze staan allemaal op QubicMap; elk linkt naar zijn projectpagina en naar de tool zelf.", "Инструменты для просмотра адресов, транзакций, тиков и эпох в сети Qubic. Все они есть на QubicMap; у каждого есть ссылка на страницу проекта и на сам инструмент.", "Tools zum Nachschlagen von Adressen, Transaktionen, Ticks und Epochen im Qubic-Netzwerk. Alle sind auf QubicMap gelistet; jedes verlinkt auf seine Projektseite und auf das Tool selbst."],
 "At a glance": ["En un coup d'œil", "De un vistazo", "一览", "In één oogopslag", "Коротко", "Auf einen Blick"],
 "Tool": ["Outil", "Herramienta", "工具", "Tool", "Инструмент", "Tool"],
 "Addresses": ["Adresses", "Direcciones", "地址", "Adressen", "Адреса", "Adressen"],
 "Transactions": ["Transactions", "Transacciones", "交易", "Transacties", "Транзакции", "Transaktionen"],
 "Ticks": ["Ticks", "Ticks", "Tick", "Ticks", "Тики", "Ticks"],
 "Contracts": ["Contrats", "Contratos", "合约", "Contracten", "Контракты", "Verträge"],
 "Mining": ["Minage", "Minería", "挖矿", "Mining", "Майнинг", "Mining"],
 "official": ["officiel", "oficial", "官方", "officieel", "официальный", "offiziell"],
 "beta": ["bêta", "beta", "测试版", "bèta", "бета", "Beta"],
 "flows": ["flux", "flujos", "资金流", "stromen", "потоки", "Flüsse"],
 "pools": ["pools", "pools", "矿池", "pools", "пулы", "Pools"],
 "hashrate": ["hashrate", "hashrate", "算力", "hashrate", "хешрейт", "Hashrate"],
 "live packets": ["paquets en direct", "paquetes en directo", "实时数据包", "live pakketten", "пакеты в реальном времени", "Live-Pakete"],
 "Details on each tool below.": ["Le détail de chaque outil ci-dessous.", "Detalles de cada herramienta más abajo.", "各工具详情见下文。", "Details per tool hieronder.", "Подробнее о каждом инструменте ниже.", "Details zu jedem Tool weiter unten."],
 "Block explorers": ["Explorateurs de blocs", "Exploradores de bloques", "区块浏览器", "Block explorers", "Блок-эксплореры", "Block-Explorer"],
 "Network views and analytics": ["Vues du réseau et analyses", "Vistas de la red y análisis", "网络视图与分析", "Netwerkweergaven en analyses", "Сеть и аналитика", "Netzwerkansichten und Analysen"],
 "Common questions": ["Questions fréquentes", "Preguntas frecuentes", "常见问题", "Veelgestelde vragen", "Частые вопросы", "Häufige Fragen"],
 "How do I check a Qubic transaction?": ["Comment vérifier une transaction Qubic ?", "¿Cómo compruebo una transacción de Qubic?", "如何查询一笔 Qubic 交易？", "Hoe controleer ik een Qubic-transactie?", "Как проверить транзакцию Qubic?", "Wie prüfe ich eine Qubic-Transaktion?"],
 "Paste the transaction ID or the address into Qubic Explorer. Qubic Report also shows the transactions of each tick as they happen.": ["Collez l'identifiant de la transaction ou l'adresse dans Qubic Explorer. Qubic Report affiche aussi les transactions de chaque tick au fil de l'eau.", "Pega el ID de la transacción o la dirección en Qubic Explorer. Qubic Report también muestra las transacciones de cada tick a medida que ocurren.", "将交易 ID 或地址粘贴到 Qubic Explorer 中。Qubic Report 也会实时显示每个 tick 的交易。", "Plak de transactie-ID of het adres in Qubic Explorer. Qubic Report toont ook de transacties van elke tick terwijl ze plaatsvinden.", "Вставьте ID транзакции или адрес в Qubic Explorer. Qubic Report также показывает транзакции каждого тика по мере их появления.", "Füge die Transaktions-ID oder die Adresse in Qubic Explorer ein. Qubic Report zeigt die Transaktionen jedes Ticks ebenfalls live an."],
 "What is a tick?": ["Qu'est-ce qu'un tick ?", "¿Qué es un tick?", "什么是 tick？", "Wat is een tick?", "Что такое тик?", "Was ist ein Tick?"],
 "A tick is one step of the Qubic network, during which the computors agree on a set of transactions. An epoch groups the ticks of one week.": ["Un tick est une étape du réseau Qubic, pendant laquelle les computors s'accordent sur un lot de transactions. Une époque regroupe les ticks d'une semaine.", "Un tick es un paso de la red Qubic, durante el cual los computors acuerdan un conjunto de transacciones. Una época agrupa los ticks de una semana.", "tick 是 Qubic 网络的一个步骤，计算节点（computors）在其中就一组交易达成一致。一个纪元包含一周内的所有 tick。", "Een tick is één stap van het Qubic-netwerk, waarin de computors het eens worden over een reeks transacties. Een epoch omvat de ticks van één week.", "Тик — это один шаг сети Qubic, во время которого компьюторы согласуют набор транзакций. Эпоха объединяет тики одной недели.", "Ein Tick ist ein Schritt des Qubic-Netzwerks, in dem sich die Computoren auf eine Reihe von Transaktionen einigen. Eine Epoche umfasst die Ticks einer Woche."],
 "See also": ["Voir aussi", "Ver también", "相关", "Zie ook", "См. также", "Siehe auch"],
 "All {n} projects on the map": ["Les {n} projets sur la carte", "Los {n} proyectos en el mapa", "地图上的全部 {n} 个项目", "Alle {n} projecten op de kaart", "Все {n} проектов на карте", "Alle {n} Projekte auf der Karte"],
 "Connections between projects": ["Liens entre les projets", "Conexiones entre proyectos", "项目之间的关联", "Verbanden tussen projecten", "Связи между проектами", "Verbindungen zwischen Projekten"],
 "Independent, community-run directory, for information only. A listing is not an endorsement: check each tool yourself, and never type your seed into a website.": ["Annuaire indépendant tenu par la communauté, à titre d'information uniquement. Être listé n'est pas une recommandation : vérifiez chaque outil vous-même et ne saisissez jamais votre seed sur un site web.", "Directorio independiente y comunitario, solo con fines informativos. Figurar aquí no es una recomendación: comprueba cada herramienta por tu cuenta y nunca escribas tu seed en un sitio web.", "独立的社区目录，仅供参考。被收录并不代表推荐：请自行核实每个工具，切勿在任何网站输入你的种子（seed）。", "Onafhankelijke, door de community beheerde gids, alleen ter informatie. Een vermelding is geen aanbeveling: controleer elke tool zelf en typ je seed nooit in op een website.", "Независимый каталог, который ведёт сообщество, только для информации. Включение в список — не рекомендация: проверяйте каждый инструмент сами и никогда не вводите свой seed на сайте.", "Unabhängiges, von der Community geführtes Verzeichnis, nur zur Information. Ein Eintrag ist keine Empfehlung: Prüfe jedes Tool selbst und gib deinen Seed nie auf einer Website ein."],
 "Qubic wallets: compare web, desktop and hardware wallets": ["Wallets Qubic : comparez les portefeuilles web, desktop et matériels", "Wallets de Qubic: compara monederos web, de escritorio y hardware", "Qubic 钱包：比较网页、桌面和硬件钱包", "Qubic-wallets: vergelijk web-, desktop- en hardwarewallets", "Кошельки Qubic: сравнение веб-, десктопных и аппаратных кошельков", "Qubic-Wallets: Web-, Desktop- und Hardware-Wallets im Vergleich"],
 "Where to keep QUBIC: the official Qubic Wallet, desktop and hardware wallets, a MetaMask Snap and multisig vaults, side by side.": ["Où garder vos QUBIC : le Qubic Wallet officiel, des wallets desktop et matériels, un Snap MetaMask et des coffres multisignatures, côte à côte.", "Dónde guardar tus QUBIC: el Qubic Wallet oficial, monederos de escritorio y hardware, un Snap de MetaMask y bóvedas multifirma, lado a lado.", "在哪里存放 QUBIC：官方 Qubic Wallet、桌面和硬件钱包、MetaMask Snap 以及多签金库，一目了然。", "Waar bewaar je QUBIC: de officiële Qubic Wallet, desktop- en hardwarewallets, een MetaMask Snap en multisig-kluizen naast elkaar.", "Где хранить QUBIC: официальный Qubic Wallet, десктопные и аппаратные кошельки, Snap для MetaMask и мультиподписные хранилища — в одном сравнении.", "Wo du QUBIC aufbewahrst: die offizielle Qubic Wallet, Desktop- und Hardware-Wallets, ein MetaMask Snap und Multisig-Tresore im Vergleich."],
 "Qubic wallets": ["Wallets Qubic", "Wallets de Qubic", "Qubic 钱包", "Qubic-wallets", "Кошельки Qubic", "Qubic-Wallets"],
 "Wallets and custody services for QUBIC and Qubic tokens. All are listed on QubicMap; each links to its project page and to the wallet itself.": ["Wallets et services de conservation pour les QUBIC et les tokens Qubic. Tous sont référencés sur QubicMap ; chacun renvoie à sa fiche projet et au wallet lui-même.", "Monederos y servicios de custodia para QUBIC y los tokens de Qubic. Todos figuran en QubicMap; cada uno enlaza a su página de proyecto y al propio monedero.", "用于存放 QUBIC 和 Qubic 代币的钱包与托管服务。它们都收录在 QubicMap 上，每个都链接到其项目页面和钱包本身。", "Wallets en bewaardiensten voor QUBIC en Qubic-tokens. Ze staan allemaal op QubicMap; elk linkt naar zijn projectpagina en naar de wallet zelf.", "Кошельки и кастодиальные сервисы для QUBIC и токенов Qubic. Все они есть на QubicMap; у каждого есть ссылка на страницу проекта и на сам кошелёк.", "Wallets und Verwahrdienste für QUBIC und Qubic-Token. Alle sind auf QubicMap gelistet; jede verlinkt auf ihre Projektseite und auf die Wallet selbst."],
 "Wallet": ["Wallet", "Monedero", "钱包", "Wallet", "Кошелёк", "Wallet"],
 "Type": ["Type", "Tipo", "类型", "Type", "Тип", "Typ"],
 "Keys held by": ["Clés détenues par", "Claves en manos de", "私钥持有者", "Sleutels bij", "Ключи у", "Schlüssel bei"],
 "Web": ["Web", "Web", "网页", "Web", "Веб", "Web"],
 "Hardware": ["Matériel", "Hardware", "硬件", "Hardware", "Аппаратный", "Hardware"],
 "Multisig contract": ["Contrat multisignature", "Contrato multifirma", "多签合约", "Multisig-contract", "Мультиподписной контракт", "Multisig-Vertrag"],
 "Rust wallet": ["Wallet en Rust", "Monedero en Rust", "Rust 钱包", "Wallet in Rust", "Кошелёк на Rust", "Wallet in Rust"],
 "Desktop": ["Desktop", "Escritorio", "桌面", "Desktop", "Десктоп", "Desktop"],
 "Institutional custody": ["Conservation institutionnelle", "Custodia institucional", "机构托管", "Institutionele bewaring", "Институциональное хранение", "Institutionelle Verwahrung"],
 "You": ["Vous", "Tú", "你自己", "Jij", "Вы", "Du"],
 "You (on the device)": ["Vous (sur l'appareil)", "Tú (en el dispositivo)", "你自己（在设备上）", "Jij (op het apparaat)", "Вы (на устройстве)", "Du (auf dem Gerät)"],
 "You (in MetaMask)": ["Vous (dans MetaMask)", "Tú (en MetaMask)", "你自己（在 MetaMask 中）", "Jij (in MetaMask)", "Вы (в MetaMask)", "Du (in MetaMask)"],
 "Co-owners": ["Les co-propriétaires", "Los copropietarios", "共同所有人", "De mede-eigenaars", "Совладельцы", "Die Miteigentümer"],
 "The provider": ["Le prestataire", "El proveedor", "服务商", "De aanbieder", "Провайдер", "Der Anbieter"],
 "Details on each wallet below.": ["Le détail de chaque wallet ci-dessous.", "Detalles de cada monedero más abajo.", "各钱包详情见下文。", "Details per wallet hieronder.", "Подробнее о каждом кошельке ниже.", "Details zu jeder Wallet weiter unten."],
 "Everyday wallets": ["Wallets du quotidien", "Monederos para el día a día", "日常钱包", "Wallets voor dagelijks gebruik", "Кошельки на каждый день", "Wallets für den Alltag"],
 "Hardware and shared vaults": ["Matériel et coffres partagés", "Hardware y bóvedas compartidas", "硬件钱包与共享金库", "Hardware en gedeelde kluizen", "Аппаратные кошельки и общие хранилища", "Hardware und geteilte Tresore"],
 "For institutions": ["Pour les institutions", "Para instituciones", "面向机构", "Voor instellingen", "Для организаций", "Für Institutionen"],
 "Which Qubic wallet is the official one?": ["Quel est le wallet Qubic officiel ?", "¿Cuál es el monedero oficial de Qubic?", "哪个是官方 Qubic 钱包？", "Welke Qubic-wallet is de officiële?", "Какой кошелёк Qubic официальный?", "Welche Qubic-Wallet ist die offizielle?"],
 "Qubic Wallet, at wallet.qubic.org, is the official web wallet. Check the address in your browser before you type anything.": ["Qubic Wallet, à l'adresse wallet.qubic.org, est le wallet web officiel. Vérifiez l'adresse dans votre navigateur avant de saisir quoi que ce soit.", "Qubic Wallet, en wallet.qubic.org, es el monedero web oficial. Comprueba la dirección en tu navegador antes de escribir nada.", "Qubic Wallet（wallet.qubic.org）是官方网页钱包。输入任何内容之前，请先核对浏览器中的网址。", "Qubic Wallet, op wallet.qubic.org, is de officiële webwallet. Controleer het adres in je browser voordat je iets intypt.", "Qubic Wallet по адресу wallet.qubic.org — официальный веб-кошелёк. Прежде чем что-либо вводить, проверьте адрес в браузере.", "Qubic Wallet unter wallet.qubic.org ist die offizielle Web-Wallet. Prüfe die Adresse in deinem Browser, bevor du etwas eingibst."],
 "What is a Qubic seed?": ["Qu'est-ce qu'une seed Qubic ?", "¿Qué es una seed de Qubic?", "什么是 Qubic 种子（seed）？", "Wat is een Qubic-seed?", "Что такое seed Qubic?", "Was ist ein Qubic-Seed?"],
 "The seed is the 55-letter secret that controls a Qubic address. Anyone who has it can move the funds: keep it offline, and only enter it in a wallet you have checked.": ["La seed est le secret de 55 lettres qui contrôle une adresse Qubic. Quiconque la possède peut déplacer les fonds : gardez-la hors ligne et ne la saisissez que dans un wallet que vous avez vérifié.", "La seed es el secreto de 55 letras que controla una dirección de Qubic. Quien la tenga puede mover los fondos: guárdala sin conexión y escríbela solo en un monedero que hayas comprobado.", "种子是控制一个 Qubic 地址的 55 个字母的密钥。任何拿到它的人都能转走资金：请离线保存，只在你核实过的钱包中输入。", "De seed is het geheim van 55 letters dat een Qubic-adres beheert. Wie hem heeft, kan de tegoeden verplaatsen: bewaar hem offline en voer hem alleen in bij een wallet die je hebt gecontroleerd.", "Seed — это секрет из 55 букв, который управляет адресом Qubic. Любой, у кого он есть, может перевести средства: храните его офлайн и вводите только в проверенный кошелёк.", "Der Seed ist das Geheimnis aus 55 Buchstaben, das eine Qubic-Adresse kontrolliert. Wer ihn hat, kann die Guthaben bewegen: Bewahre ihn offline auf und gib ihn nur in eine Wallet ein, die du geprüft hast."],
}

def gt(k, i):
    v = GT.get(k)
    if i is None: return k
    if v and v[i]: return v[i]
    return t(k, i)  # map translations (project descriptions, "Project page", "Open", "Explorers"...)

Y = True
# the small Qubic logo of the home page header, linked to the map
_a = s.find('<svg class="qlogo"'); QLOGO = '\n'.join(x for x in s[_a:s.find('</svg>', _a) + 6].split('\n') if x.strip())
GUIDES = [{
  "page": "explorers", "cat": "explorer", "catname": "Explorers", "lastmod": "2026-11-16", "colh": "Tool", "note": "Details on each tool below.", "text": False,
  "title": "Qubic explorers: compare block explorers and network tools",
  "desc": "Look up Qubic addresses, transactions, ticks and epochs. Compare the official Qubic Explorer, Qubic Report and live network tools side by side.",
  "h1": "Qubic explorers",
  "lead": "Tools to look up addresses, transactions, ticks and epochs on the Qubic network. All are listed on QubicMap; each links to its project page and to the tool itself.",
  "cols": ["Addresses", "Transactions", "Ticks", "Contracts", "Mining"],
  "rows": [["Qubic Explorer", "official", [Y, Y, Y, 0, 0]],
           ["Qubic Report", "beta", [0, Y, Y, Y, Y]],
           ["Tick Unlocked", "", [0, "flows", 0, Y, "pools"]],
           ["Jetski Tracker", "", [0, 0, 0, 0, "hashrate"]],
           ["Qubic Live", "", [0, "live packets", 0, 0, 0]]],
  "groups": [["Block explorers", ["Qubic Explorer", "Qubic Report"]],
             ["Network views and analytics", ["Qubic Live", "Tick Unlocked", "Jetski Tracker"]]],
  "faq": [["How do I check a Qubic transaction?", "Paste the transaction ID or the address into Qubic Explorer. Qubic Report also shows the transactions of each tick as they happen."],
          ["What is a tick?", "A tick is one step of the Qubic network, during which the computors agree on a set of transactions. An epoch groups the ticks of one week."]],
}, {
  "page": "wallets", "cat": "custody", "catname": "Wallets and custody", "lastmod": "2026-11-16", "colh": "Wallet", "note": "Details on each wallet below.", "text": True,
  "title": "Qubic wallets: compare web, desktop and hardware wallets",
  "desc": "Where to keep QUBIC: the official Qubic Wallet, desktop and hardware wallets, a MetaMask Snap and multisig vaults, side by side.",
  "h1": "Qubic wallets",
  "lead": "Wallets and custody services for QUBIC and Qubic tokens. All are listed on QubicMap; each links to its project page and to the wallet itself.",
  "cols": ["Type", "Keys held by"],
  "rows": [["Qubic Wallet", "official", ["Web", "You"]],
           ["Glyph", "", ["Desktop", "You"]],
           ["Rubic", "", ["Rust wallet", "You"]],
           ["Qubic-Connect", "", ["MetaMask Snap", "You (in MetaMask)"]],
           ["HASHWallet", "", ["Hardware", "You (on the device)"]],
           ["MSVault", "", ["Multisig contract", "Co-owners"]],
           ["Onyze", "", ["Institutional custody", "The provider"]]],
  "groups": [["Everyday wallets", ["Qubic Wallet", "Glyph", "Rubic", "Qubic-Connect"]],
             ["Hardware and shared vaults", ["HASHWallet", "MSVault"]],
             ["For institutions", ["Onyze"]]],
  "faq": [["Which Qubic wallet is the official one?", "Qubic Wallet, at wallet.qubic.org, is the official web wallet. Check the address in your browser before you type anything."],
          ["What is a Qubic seed?", "The seed is the 55-letter secret that controls a Qubic address. Anyone who has it can move the funds: keep it offline, and only enter it in a wallet you have checked."]],
}]

CSS = """:root{color-scheme:dark;--void:#04070c;--panel:#0a1019;--rule:#182434;--ink:#dfe9f3;--muted:#7f93a8;--ice:#cfe6ff;--live:#62d6a0;--warn:#f1bb5c;
--display:"Chakra Petch",system-ui,sans-serif;--sans:"IBM Plex Sans","PingFang SC","Microsoft YaHei",system-ui,-apple-system,"Segoe UI",sans-serif;--mono:"IBM Plex Mono",ui-monospace,Menlo,monospace}
:root[data-theme="light"]{color-scheme:light;--void:#f4f6f9;--panel:#ffffff;--rule:#d5dde6;--ink:#0b1220;--muted:#566577;--ice:#1f5fa8;--live:#14865a;--warn:#a86b00}
*{box-sizing:border-box}body{margin:0;background:var(--void);color:var(--ink);font:16px/1.55 var(--sans)}
a{color:var(--ice);text-underline-offset:3px}
.wrap{max-width:860px;margin:0 auto;padding:22px 16px 60px}
.logo{display:inline-block;margin-bottom:14px}.qlogo{display:block;height:26px;width:auto;color:var(--ink)}
.back{font:13px var(--mono);color:var(--muted)}.back a{color:inherit}
h1{margin:10px 0 8px;font:700 clamp(32px,7vw,54px)/1.05 var(--display);letter-spacing:.01em}
.lead{color:var(--muted);max-width:64ch;margin:0}
h2{margin:36px 0 12px;font:700 18px var(--display);letter-spacing:.08em;text-transform:uppercase}
.tw{overflow-x:auto;border:1px solid var(--rule);background:var(--panel)}
table{width:100%;border-collapse:collapse;font-size:15px}
th,td{text-align:left;padding:11px 12px;border-bottom:1px solid var(--rule);vertical-align:top}
tr:last-child td{border-bottom:0}
th{font:500 11.5px var(--mono);letter-spacing:.1em;text-transform:uppercase;color:var(--muted);white-space:nowrap}
td:first-child,th:first-child{position:sticky;left:0;background:var(--panel);min-width:120px}
td small{display:block;font:12px var(--mono);color:var(--muted)}
.y{color:var(--live)}.n{color:var(--muted)}
.note{font-size:13px;color:var(--muted);margin:8px 0 0}
.card{background:var(--panel);border:1px solid var(--rule);padding:14px 16px;margin-bottom:10px}
.card h3{margin:0;font:600 17px var(--sans)}.card h3 a{color:var(--ink);text-decoration:none}
.card p{margin:6px 0 12px}
.acts{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.tag{font:12px var(--mono);color:var(--muted);border:1px solid var(--rule);padding:2px 8px}.tag.live{color:var(--live)}
.btn{font:600 12px var(--display);letter-spacing:.1em;text-transform:uppercase;text-decoration:none;border:1px solid var(--rule);color:var(--ink);padding:8px 12px}
.btn:hover{border-color:var(--ice)}
details{background:var(--panel);border:1px solid var(--rule);padding:12px 16px;margin-bottom:8px}
summary{cursor:pointer;font-weight:500}details p{margin:8px 0 0}
.rel{display:flex;flex-wrap:wrap;gap:8px}
footer{margin-top:40px;border-top:1px solid var(--rule);padding-top:14px;font:12.5px var(--mono);color:var(--muted)}
@media(max-width:560px){th,td{padding:9px 8px;font-size:14px}th{font-size:10px}}"""

def guide_html(g, i):
    l = 'en' if i is None else LG[i]; pre = '' if i is None else '/' + l
    url = URL + ('' if i is None else l + '/') + g['page']
    T = gt(g['title'], i) + ' | QubicMap'; D = gt(g['desc'], i)
    by = {e[1]: e for e in E}
    alt = ''.join('<link rel="alternate" hreflang="%s" href="%s%s%s">' % (HL.get(x, x), URL, '' if x == 'en' else x + '/', g['page']) for x in ['en'] + LG) \
        + '<link rel="alternate" hreflang="x-default" href="%s%s">' % (URL, g['page'])
    ld = [{"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": "QubicMap", "item": URL + ('' if i is None else l + '/')},
            {"@type": "ListItem", "position": 2, "name": gt(g['h1'], i), "item": url}]},
          {"@context": "https://schema.org", "@type": "FAQPage", "mainEntity": [
            {"@type": "Question", "name": gt(q, i), "acceptedAnswer": {"@type": "Answer", "text": gt(a, i)}} for q, a in g['faq']]}]
    cell = (lambda v: '<td>%s</td>' % esc(gt(v, i))) if g['text'] else (lambda v: '<td class="n">–</td>' if not v else ('<td class="y">✓</td>' if v is True else '<td class="y">✓ %s</td>' % esc(gt(v, i))))
    rows = ''.join('<tr><td><a href="%s/p/%s">%s</a>%s</td>%s</tr>' % (pre, slug(n), esc(n), '<small>%s</small>' % esc(gt(tag, i)) if tag else '', ''.join(cell(v) for v in vals))
                   for n, tag, vals in g['rows'])
    tagof = {n: tag for n, tag, _ in g['rows']}
    def card(n):
        e = by[n]; s = slug(n)
        tags = ('<span class="tag live">%s</span>' % esc(gt('Live', i)) if e[3] == 'live' else '') + ('<span class="tag">%s</span>' % esc(gt(tagof[n], i)) if tagof.get(n) else '')
        return ('<div class="card"><h3><a href="%s/p/%s">%s</a></h3><p>%s</p><div class="acts">%s<a class="btn" href="%s/p/%s">%s</a><a class="btn" href="%s" rel="noopener" target="_blank">%s ↗</a></div></div>'
                % (pre, s, esc(n), esc(gt(e[5], i)), tags, pre, s, esc(gt('Project page', i)), esc(e[4]), esc(gt('Open', i))))
    groups = ''.join('<h2>%s</h2>%s' % (esc(gt(h, i)), ''.join(card(n) for n in ns)) for h, ns in g['groups'])
    faq = ''.join('<details><summary>%s</summary><p>%s</p></details>' % (esc(gt(q, i)), esc(gt(a, i))) for q, a in g['faq'])
    home = pre + '/'
    return ('<!doctype html><html lang="%s"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
        '<title>%s</title><meta name="description" content="%s"><link rel="canonical" href="%s">%s'
        '<meta property="og:type" content="website"><meta property="og:site_name" content="Qubic Ecosystem Map"><meta property="og:title" content="%s"><meta property="og:description" content="%s"><meta property="og:url" content="%s"><meta property="og:image" content="%scover.jpg">'
        '<meta name="twitter:card" content="summary_large_image"><meta name="theme-color" content="#04070c"><link rel="icon" href="/favicon.ico"><link rel="apple-touch-icon" href="/icons/icon-180.png">'
        '<script>try{if(localStorage.getItem("qem.theme")==="light")document.documentElement.setAttribute("data-theme","light")}catch(e){}</script>'
        '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
        '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@600;700&family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600&display=swap">'
        '<script type="application/ld+json">%s</script><style>%s</style></head><body><div class="wrap"><a class="logo" href="%s">%s</a>'
        '<div class="back"><a href="%s">QubicMap</a> › <a href="%s#%s">%s</a></div>'
        '<h1>%s</h1><p class="lead">%s</p>'
        '<h2>%s</h2><div class="tw"><table><thead><tr><th>%s</th>%s</tr></thead><tbody>%s</tbody></table></div><p class="note">%s</p>'
        '%s<h2>%s</h2>%s'
        '<h2>%s</h2><div class="rel">' + ''.join('<a class="btn" href="%s/%s">%s</a>' % (pre, o['page'], esc(gt(o['h1'], i))) for o in GUIDES if o is not g) + '<a class="btn" href="%s">%s</a><a class="btn" href="/connections">%s</a></div>'
        '<footer><p>%s</p>Qubic Ecosystem Map · <a href="/legal">%s</a></footer></div></body></html>\n') % (
        HL.get(l, l), esc(T), esc(D), url, alt, esc(T), esc(D), url, URL,
        _json.dumps(ld, ensure_ascii=False).replace('</', '<\\/'), CSS, home, QLOGO,
        home, home, g['cat'], esc(gt(g['catname'], i)),
        esc(gt(g['h1'], i)), esc(gt(g['lead'], i)),
        esc(gt('At a glance', i)), esc(gt(g['colh'], i)), ''.join('<th>%s</th>' % esc(gt(c, i)) for c in g['cols']), rows, esc(gt(g['note'], i)),
        groups, esc(gt('Common questions', i)), faq,
        esc(gt('See also', i)), home, esc(gt('All {n} projects on the map', i).replace('{n}', str(len(E)))), esc(gt('Connections between projects', i)),
        esc(gt('Independent, community-run directory, for information only. A listing is not an endorsement: check each tool yourself, and never type your seed into a website.', i)),
        esc(gt('Legal notice', i)))

for g in GUIDES:
    for n, _, _ in g['rows']: assert n in {e[1] for e in E}, n
    wr('public/%s.html' % g['page'], guide_html(g, None))
    for i, l in enumerate(LG): wr('public/%s/%s.html' % (l, g['page']), guide_html(g, i))
