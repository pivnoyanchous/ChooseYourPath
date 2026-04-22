const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const dirs = ['public/audio', 'public/images/avatars', 'public/images/maps'];
dirs.forEach(dir => { if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); });

const db = new sqlite3.Database('./database.sqlite', (err) => {
    if (err) process.exit(1);
});

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        login TEXT UNIQUE,
        password TEXT,
        avatar TEXT DEFAULT 'default.png',
        total_xp INTEGER DEFAULT 0,
        current_level INTEGER DEFAULT 1
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS progress (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        route_id TEXT,
        route_name TEXT,
        progress_percent INTEGER,
        FOREIGN KEY(user_id) REFERENCES users(id)
    )`);
    db.run(`ALTER TABLE progress ADD COLUMN route_name TEXT`, () => {});
    db.run(`ALTER TABLE progress ADD COLUMN completion_awarded INTEGER DEFAULT 0`, () => {});
    db.run(`CREATE TABLE IF NOT EXISTS favorites (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        route_id TEXT,
        point_index INTEGER,
        point_title TEXT,
        point_panorama TEXT,
        FOREIGN KEY(user_id) REFERENCES users(id)
    )`);
});

const XP_PER_LEVEL = 120;
const THEME_XP_MULTIPLIER = {
    samara: 1.0,
    georgia: 1.15,
    silk: 1.25
};
const DIFFICULTY_XP_MULTIPLIER = {
    'Лёгкий': 1.0,
    'Средний': 1.2,
    'Сложный': 1.4
};

function findRouteMeta(routeId) {
    for (const [themeId, routes] of Object.entries(ROUTES)) {
        const route = routes.find((item) => item.id === routeId);
        if (route) return { route, themeId };
    }
    return null;
}

function clampPercent(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.min(100, Math.round(n)));
}

function calcRouteXp(deltaPercent, route, themeId) {
    const themeCoef = THEME_XP_MULTIPLIER[themeId] || 1.0;
    const difficultyCoef = DIFFICULTY_XP_MULTIPLIER[route.difficulty] || 1.0;
    const pointsCoef = Math.max(1, (route.pointsData?.length || 7) / 7);
    const raw = deltaPercent * 0.9 * themeCoef * difficultyCoef * pointsCoef;
    return Math.max(0, Math.round(raw));
}

const THEMES = [
    { id: 'samara', name: 'Многонациональная Самара', icon: 'map' },
    { id: 'georgia', name: 'Гастрономическое путешествие по Грузии', icon: 'utensils' },
    { id: 'silk', name: 'Тайны Великого Шелкового пути', icon: 'route' }
];

const ROUTES = {
    samara: [
        {
            id: 'samara1',
            name: 'Наследие предков',
            description: 'Погружение в многонациональную Самару: от волжских панорам до мест, где переплелись традиции русских, татар, мордвы и чувашей.',
            difficulty: 'Средний',
            duration: '60 мин',
            routeAudio: 'audio/mordovian.mp3',
            pointsData: [
                { title: 'Точка 1', desc: 'Начало пути.', panorama: 'nEkucm0V1r', source: 'Panoraven', nextMap: '3ewmvtp7GX' },
                { title: 'Точка 2', desc: 'Продолжение маршрута.', panorama: 'JydCnvWRFj', source: 'Panoraven', nextMap: '3pW0iPvpUk' },
                { title: 'Точка 3', desc: 'Центральная часть маршрута.', panorama: '1SKIUWWJLm', source: 'Panoraven', nextMap: 'eGUxapHVxL' },
                { title: 'Точка 4', desc: 'Историческое место.', panorama: 'S8WN99Cibo', source: 'Panoraven', nextMap: '2222BxNNmY' },
                { title: 'Точка 5', desc: 'Панорамный обзор.', panorama: 'pFwChiFIqU', source: 'Panoraven', nextMap: 'cxC2Y8401k' },
                { title: 'Точка 6', desc: 'Переход к финалу.', panorama: 'YdFfSi5iLg', source: 'Panoraven', nextMap: 'UlcVXMsZsT' },
                { title: 'Точка 7', desc: 'Завершение маршрута.', panorama: 'k3NafA2lXm', source: 'Panoraven', nextMap: null }
            ],
            quiz: [
                { q: 'Сколько точек в маршруте?', options: ['5', '7', '9'], ans: 1 },
                { q: 'Что используется между точками?', options: ['Карта перехода', 'Только текст', 'Ничего'], ans: 0 },
                { q: 'Где можно сохранить понравившуюся точку?', options: ['В избранном', 'В чате', 'Нигде'], ans: 0 },
                { q: 'Что отображает индикатор сверху?', options: ['Температуру', 'Прогресс маршрута', 'Уровень звука'], ans: 1 },
                { q: 'Можно ли вернуться назад на точку?', options: ['Да', 'Нет', 'Только после викторины'], ans: 0 }
            ]
        },
        {
            id: 'samara2',
            name: 'Скрытые тропы',
            description: 'Экспедиция по малозаметным, но живым следам культуры: ремёсла, локальные легенды и атмосферные точки Самарского края.',
            difficulty: 'Сложный',
            duration: '90 мин',
            routeAudio: 'audio/mordovian.mp3',
            pointsData: [
                { title: 'Точка 1', desc: 'Старт маршрута.', panorama: 'vKzLpQPS8z', source: 'Panoraven', nextMap: 'AplkMIIvF0' },
                { title: 'Точка 2', desc: 'Новая локация.', panorama: 'IUUvfA724N', source: 'Panoraven', nextMap: '4FCnWrW90E' },
                { title: 'Точка 3', desc: 'Легендарная точка.', panorama: 'V9mJY6r22P', source: 'Panoraven', nextMap: '5qfvTRz21m' },
                { title: 'Точка 4', desc: 'Панорамный обзор.', panorama: 'JNmxzzYoiT', source: 'Panoraven', nextMap: 'gkfo56dxhZ' },
                { title: 'Точка 5', desc: 'Уютная точка маршрута.', panorama: 'MOODPY2Dil', source: 'Panoraven', nextMap: '3lL7a3TzNW' },
                { title: 'Точка 6', desc: 'Перед финалом.', panorama: 'jgPcGusjTr', source: 'Panoraven', nextMap: 'hqKa4hiM5k' },
                { title: 'Точка 7', desc: 'Финальная точка.', panorama: 'P12uTWOEt9', source: 'Panoraven', nextMap: null }
            ],
            quiz: [
                { q: 'Маршрут содержит минимум сколько точек?', options: ['3', '5', '7'], ans: 2 },
                { q: 'Что нужно сделать в конце маршрута?', options: ['Пройти викторину', 'Закрыть сайт', 'Сменить тему'], ans: 0 },
                { q: 'Можно ли начать маршрут заново?', options: ['Да', 'Нет', 'Только после выхода'], ans: 0 },
                { q: 'Что происходит при ошибках >50%?', options: ['Маршрут начинается заново', 'Открывается профиль', 'Ничего'], ans: 0 },
                { q: 'Где смотреть общий прогресс?', options: ['В профиле', 'Только в консоли', 'Нигде'], ans: 0 }
            ]
        },
        {
            id: 'samara3',
            name: 'Городские легенды',
            description: 'Маршрут-сказание о Самаре: загадочные городские пространства, истории старых кварталов и дух волжских преданий.',
            difficulty: 'Лёгкий',
            duration: '45 мин',
            routeAudio: 'audio/mordovian.mp3',
            pointsData: [
                { title: 'Точка 1', desc: 'Старт.', panorama: 'SZuDFccjN4', source: 'Panoraven', nextMap: 'EtNecKFYdI' },
                { title: 'Точка 2', desc: 'Переход в историю.', panorama: 'V1bStnoIs6', source: 'Panoraven', nextMap: 'zrGmHmIrDz' },
                { title: 'Точка 3', desc: 'Знаковое место.', panorama: 'spGRIFyZn7', source: 'Panoraven', nextMap: 'GcZtl4pUNs' },
                { title: 'Точка 4', desc: 'Загадочный угол.', panorama: 'iIlzNpRK4D', source: 'Panoraven', nextMap: 'Irm8FzSZOO' },
                { title: 'Точка 5', desc: 'Легендарная площадь.', panorama: '6AUX7gjFsM', source: 'Panoraven', nextMap: 'nTJlIJ1FlK' },
                { title: 'Точка 6', desc: 'Секретный проход.', panorama: 'OsVkeDVxRx', source: 'Panoraven', nextMap: 'TFcg5c86hY' },
                { title: 'Точка 7', desc: 'Триумфальный финал.', panorama: '1u8cR1khkh', source: 'Panoraven', nextMap: null }
            ],
            quiz: [
                { q: 'Можно ли добавлять точки в избранное?', options: ['Да', 'Нет', 'Только в профиле'], ans: 0 },
                { q: 'Сколько маршрутов в теме Самара?', options: ['1', '2', '3'], ans: 2 },
                { q: 'Какая кнопка возвращает к выбору темы?', options: ['Вернуться к карте', 'Только логотип', 'Никакая'], ans: 0 },
                { q: 'Что показывается между точками?', options: ['Карта перехода', 'Пустой экран', 'Реклама'], ans: 0 },
                { q: 'Где менять аватар?', options: ['В профиле', 'В маршруте', 'На странице входа'], ans: 0 }
            ]
        }
    ],
    georgia: [
        {
            id: 'georgia1',
            name: 'Классика Западной Грузии',
            description: 'Вкусная классика Западной Грузии: от имеретинского хачапури до сванского кубдари и морского колорита Батуми.',
            difficulty: 'Средний',
            duration: '120 мин',
            routeAudio: 'audio/mordovian.mp3',
            pointsData: [
                { title: 'Кутаиси · Hacker-Pschorr Kutaisi', desc: 'Традиционные блюда Имеретии.', panorama: 'nEkucm0V1r', source: 'Panoraven', nextMap: '3ewmvtp7GX' },
                { title: 'Зестафони · Gourmand', desc: 'Хачапури и региональная кухня.', panorama: 'JydCnvWRFj', source: 'Panoraven', nextMap: '3pW0iPvpUk' },
                { title: 'Амбролаури · Таверна Крихула', desc: 'Кухня Рачи и локальные продукты.', panorama: '1SKIUWWJLm', source: 'Panoraven', nextMap: 'eGUxapHVxL' },
                { title: 'Местиа · Erti Kava Coffee Room', desc: 'Сванские вкусы в горах.', panorama: 'S8WN99Cibo', source: 'Panoraven', nextMap: '2222BxNNmY' },
                { title: 'Зугдиди · Диарони', desc: 'Мегрельская кухня.', panorama: 'pFwChiFIqU', source: 'Panoraven', nextMap: 'cxC2Y8401k' },
                { title: 'Поти · Aragvi', desc: 'Черноморская гастрономия.', panorama: 'YdFfSi5iLg', source: 'Panoraven', nextMap: 'UlcVXMsZsT' },
                { title: 'Батуми · Smoke Burgers & Bar', desc: 'Современные интерпретации традиций.', panorama: 'k3NafA2lXm', source: 'Panoraven', nextMap: null }
            ],
            quiz: [
                { q: 'Как называется знаменитый грузинский пельмень?', options: ['Хинкали', 'Лаваш', 'Манты'], ans: 0 },
                { q: 'В каком городе завершает маршрут 1?', options: ['Тбилиси', 'Батуми', 'Кутаиси'], ans: 1 },
                { q: 'Какая кухня представлена в Зугдиди?', options: ['Мегрельская', 'Аджарская', 'Кахетинская'], ans: 0 },
                { q: 'Сколько точек в каждом маршруте?', options: ['5', '6', '7'], ans: 2 },
                { q: 'Что открывается между точками?', options: ['Переход по карте', 'Профиль', 'Викторина'], ans: 0 }
            ]
        },
        {
            id: 'georgia2',
            name: 'Вкусы Восточной Грузии',
            description: 'Путешествие по Восточной Грузии, где хинкали, лобио и кахетинские винные традиции раскрывают характер каждого города.',
            difficulty: 'Средний',
            duration: '130 мин',
            routeAudio: 'audio/mordovian.mp3',
            pointsData: [
                { title: 'Тбилиси · Pasanauri', desc: 'Легендарные хинкали.', panorama: 'vKzLpQPS8z', source: 'Panoraven', nextMap: 'AplkMIIvF0' },
                { title: 'Мцхета · Салобие', desc: 'Лобио и мчади.', panorama: 'IUUvfA724N', source: 'Panoraven', nextMap: '4FCnWrW90E' },
                { title: 'Сигнахи · Kusika Restaurant', desc: 'Гастрономия с видами на Алазанскую долину.', panorama: 'V9mJY6r22P', source: 'Panoraven', nextMap: '5qfvTRz21m' },
                { title: 'Телави · Zodiaco', desc: 'Кахетинские вкусы.', panorama: 'JNmxzzYoiT', source: 'Panoraven', nextMap: 'gkfo56dxhZ' },
                { title: 'Кварели · Корпорация Киндзмараули', desc: 'Культура грузинского виноделия.', panorama: 'MOODPY2Dil', source: 'Panoraven', nextMap: '3lL7a3TzNW' },
                { title: 'Велисцихе · Father & Son Cellar', desc: 'Семейные винные традиции.', panorama: 'jgPcGusjTr', source: 'Panoraven', nextMap: 'hqKa4hiM5k' },
                { title: 'Сагареджо · Vineria Kakheti', desc: 'Финальная дегустационная точка.', panorama: 'P12uTWOEt9', source: 'Panoraven', nextMap: null }
            ],
            quiz: [
                { q: 'Какая часть Грузии известна виноделием?', options: ['Кахетия', 'Сванетия', 'Аджария'], ans: 0 },
                { q: 'Старт маршрута 2 начинается в...', options: ['Тбилиси', 'Мцхете', 'Телави'], ans: 0 },
                { q: 'Что подают в Салобие?', options: ['Лобио', 'Плов', 'Лагман'], ans: 0 },
                { q: 'Сколько маршрутов в теме Грузия?', options: ['2', '3', '4'], ans: 1 },
                { q: 'Что нужно для завершения маршрута?', options: ['Пройти викторину', 'Только дойти до 7-й точки', 'Выйти из профиля'], ans: 0 }
            ]
        },
        {
            id: 'georgia3',
            name: 'Горная Грузия и её вкусы',
            description: 'Горная Грузия на вкус: пряная кухня высокогорья, тёплое гостеприимство и дороги между перевалами, крепостями и древними улочками.',
            difficulty: 'Сложный',
            duration: '140 мин',
            routeAudio: 'audio/mordovian.mp3',
            pointsData: [
                { title: 'Степанцминда · My Object', desc: 'Горная кухня и виды на Казбек.', panorama: 'SZuDFccjN4', source: 'Panoraven', nextMap: 'EtNecKFYdI' },
                { title: 'Гудаури · Vartsla', desc: 'Сытные блюда для путешественников.', panorama: 'V1bStnoIs6', source: 'Panoraven', nextMap: 'zrGmHmIrDz' },
                { title: 'Боржоми · Borjomi Plato Cafe & Bar', desc: 'Минеральная вода и локальная кухня.', panorama: 'spGRIFyZn7', source: 'Panoraven', nextMap: 'GcZtl4pUNs' },
                { title: 'Ахалцихе · Old Bar-Restaurant', desc: 'Исторический колорит и гастрономия.', panorama: 'iIlzNpRK4D', source: 'Panoraven', nextMap: 'Irm8FzSZOO' },
                { title: 'Ахалкалаки · Hovik', desc: 'Сочетание региональных традиций.', panorama: '6AUX7gjFsM', source: 'Panoraven', nextMap: 'nTJlIJ1FlK' },
                { title: 'Ниноцминда · Оджах', desc: 'Домашняя кухня горных районов.', panorama: 'OsVkeDVxRx', source: 'Panoraven', nextMap: 'TFcg5c86hY' },
                { title: 'Тбилиси · Сахли 1904', desc: 'Финал маршрута в столице.', panorama: '1u8cR1khkh', source: 'Panoraven', nextMap: null }
            ],
            quiz: [
                { q: 'Какой город завершает маршрут 3?', options: ['Тбилиси', 'Батуми', 'Телави'], ans: 0 },
                { q: 'Где находится Borjomi Plato Cafe & Bar?', options: ['Боржоми', 'Гудаури', 'Кутаиси'], ans: 0 },
                { q: 'Маршрут "Горная Грузия" содержит сколько точек?', options: ['7', '8', '9'], ans: 0 },
                { q: 'Что отображается после выбора маршрута?', options: ['Первая 360-точка', 'Профиль', 'Только карта'], ans: 0 },
                { q: 'Какой формат контента используется в точках?', options: ['360° панорамы', 'Только текст', 'Только видео'], ans: 0 }
            ]
        }
    ],
    silk: [
        {
            id: 'silk1', name: 'Звезда Востока', description: 'Классический путь караванов через Ташкент, Бухару и Самарканд — города, где торговля, наука и архитектура создали легенду Востока.', difficulty: 'Средний', duration: '90 мин', routeAudio: 'audio/silk.mp3',
            pointsData: [
                { title: 'Ташкент · Мечеть Тилла Шейх', desc: 'Древняя мечеть с богатейшей библиотекой восточных рукописей.', panorama: 'sy2hOZMR3i', source: 'Panoraven', nextMap: '4hmsurdLzc' },
                { title: 'Коканд · Мечеть Джами', desc: 'Главная соборная мечеть Коканда.', panorama: 'S3JOcIbbuZ', source: 'Panoraven', nextMap: 'iX619J9WaD' },
                { title: 'Риштан · Центр керамики', desc: 'Знаменитая риштанская керамика.', panorama: 'LgeswEP1FK', source: 'Panoraven', nextMap: 'WTANlmGFui' },
                { title: 'Маргилан · Ансамбль Хазрати Имам', desc: 'Духовный центр Ферганской долины.', panorama: 'cBEJqJ0EAj', source: 'Panoraven', nextMap: 'PQj9kB6W2k' },
                { title: 'Бухара · Пои-Калян', desc: 'Архитектурный ансамбль с минаретом Калян.', panorama: 'wCI8NUtCNz', source: 'Panoraven', nextMap: 'xXIxfqZL6C' },
                { title: 'Самарканд · Площадь Регистан', desc: 'Жемчужина Центральной Азии.', panorama: 'JGqR5yUkll', source: 'Panoraven', nextMap: 't46Guaq9OA' },
                { title: 'Шахрисабз · Ак-Сарай', desc: 'Руины грандиозного дворца Амира Темура.', panorama: 'LmPLw1teba', source: 'Panoraven', nextMap: null }
            ],
            quiz: [
                { q: 'Какой город называют «Звездой Востока»?', options: ['Самарканд', 'Бухара', 'Хива'], ans: 0 },
                { q: 'Что символизирует бирюзовый цвет риштанской керамики?', options: ['Небо', 'Воду', 'Ислам'], ans: 0 },
                { q: 'Сколько медресе на площади Регистан?', options: ['Два', 'Три', 'Четыре'], ans: 1 },
                { q: 'Что отображается между точками маршрута?', options: ['Карта перехода', 'Пустой экран', 'Профиль'], ans: 0 },
                { q: 'Где хранится прогресс пользователя?', options: ['SQLite', 'Только браузер', 'Файл txt'], ans: 0 }
            ]
        },
        {
            id: 'silk2', name: 'Забытые Оазисы', description: 'Маршрут по менее очевидным узлам Шёлкового пути: от музейных сокровищ до мест, где особенно ощущается дыхание древних торговых дорог.', difficulty: 'Сложный', duration: '110 мин', routeAudio: 'audio/silk.mp3',
            pointsData: [
                { title: 'Ташкент · Музей Темуридов', desc: 'Сокровищница истории великой династии.', panorama: 'CaUoDGj2cA', source: 'Panoraven', nextMap: '2IYKqB28Xc' },
                { title: 'Самарканд · Музей основания', desc: 'История древнего города.', panorama: 'Ec6l17k5Cx', source: 'Panoraven', nextMap: 'BZD2cS45dE' },
                { title: 'Бухара · Медресе Нодир-Девон-Беги', desc: 'Медресе с изображениями птиц счастья.', panorama: '3HVtL6aQbX', source: 'Panoraven', nextMap: 'MHZGx6hc0l' },
                { title: 'Хива · Цитадель Арк', desc: 'Древняя крепость — город в городе.', panorama: 'xSWKgO6738', source: 'Panoraven', nextMap: 'jDoNMQNBAc' },
                { title: 'Нукус · Музей им. Савицкого', desc: 'Музей русского авангарда.', panorama: 'NCpgqQt565', source: 'Panoraven', nextMap: 'XY6htxYmiD' },
                { title: 'Муйнак · Кладбище кораблей', desc: 'Памятник высохшему Аральскому морю.', panorama: 'hRUtHqf7Gg', source: 'Panoraven', nextMap: 'eYHNAvNW30' },
                { title: 'Кунград · Городище Топрак-Кала', desc: 'Руины древнего хорезмийского города.', panorama: 'SrWDm5hQWR', source: 'Panoraven', nextMap: null }
            ],
            quiz: [
                { q: 'Что хранится в музее имени Савицкого?', options: ['Русский авангард', 'Керамика', 'Ковры'], ans: 0 },
                { q: 'Что символизирует кладбище кораблей?', options: ['Экологическую катастрофу', 'Войну', 'Торговлю'], ans: 0 },
                { q: 'Где находится цитадель Арк?', options: ['Хива', 'Бухара', 'Самарканд'], ans: 0 },
                { q: 'Сколько точек в маршруте?', options: ['5', '6', '7'], ans: 2 },
                { q: 'Можно ли добавить точку в избранное?', options: ['Да', 'Нет', 'Только админу'], ans: 0 }
            ]
        },
        {
            id: 'silk3', name: 'Путь Шелка и Шелка', description: 'Мягкий, но насыщенный маршрут о ремеслах, шелкоткачестве и культурном обмене, который веками соединял Восток и Запад.', difficulty: 'Лёгкий', duration: '80 мин', routeAudio: 'audio/silk.mp3',
            pointsData: [
                { title: 'Бухара · Ансамбль Шахи Зинда', desc: 'Улица-некрополь с мавзолеями знати.', panorama: 'DcGtW6YYUk', source: 'Panoraven', nextMap: 'uRoZjYrhmg' },
                { title: 'Самарканд · Комплекс Шахи-Зинда', desc: 'Бирюзовые купола усыпальниц Тимуридов.', panorama: 'KIv8OisFSw', source: 'Panoraven', nextMap: 'RaWe8tIaB0' },
                { title: 'Шахрисабз · Дорут-Тиловат', desc: 'Мемориальный комплекс.', panorama: '1O7PZfN6tS', source: 'Panoraven', nextMap: '9KYNWmzxzE' },
                { title: 'Маргилан · Медресе Саида Ахмада Ходжи', desc: 'Центр традиционного шелкоткачества.', panorama: 'msMWpiUk09', source: 'Panoraven', nextMap: 'iD3g0PeiCg' },
                { title: 'Риштан · Мавзолей Бурхануддина', desc: 'Усыпальница великого богослова.', panorama: 'RE6hGVWhIn', source: 'Panoraven', nextMap: 'Gnwisz4Yx3' },
                { title: 'Фергана · Центральный парк', desc: 'Зелёное сердце Ферганской долины.', panorama: 'DBo75GoJ1x', source: 'Panoraven', nextMap: null },
                { title: 'Коканд · Дворец Худояр-хана', desc: 'Роскошная резиденция правителя.', panorama: 'xE4xTrJ3Pq', source: 'Panoraven', nextMap: null }
            ],
            quiz: [
                { q: 'Чем знаменит Маргилан?', options: ['Шёлк', 'Керамика', 'Ковры'], ans: 0 },
                { q: 'Что такое Шахи-Зинда?', options: ['Некрополь', 'Медресе', 'Базар'], ans: 0 },
                { q: 'Кто такой Худояр-хан?', options: ['Правитель Коканда', 'Полководец', 'Поэт'], ans: 0 },
                { q: 'Когда начинается викторина?', options: ['После маршрута', 'Сразу после входа', 'В профиле'], ans: 0 },
                { q: 'Что нужно для перехода на главную через логотип?', options: ['Авторизация и связь с сервером', 'Только клик', 'Ничего'], ans: 0 }
            ]
        }
    ]
};

app.get('/api/ping', (req, res) => res.json({ status: 'ok' }));
app.get('/api/themes', (req, res) => res.json(THEMES));

app.get('/api/routes/:themeId', (req, res) => {
    const routes = ROUTES[req.params.themeId] || [];
    res.json(routes.map(r => ({ id: r.id, name: r.name, description: r.description, difficulty: r.difficulty, duration: r.duration, points: r.pointsData.length })));
});

app.get('/api/route/:routeId', (req, res) => {
    const route = Object.values(ROUTES).flat().find(r => r.id === req.params.routeId);
    route ? res.json(route) : res.status(404).json({ error: 'Маршрут не найден' });
});

app.post('/api/auth', (req, res) => {
    const { login, password } = req.body;
    db.get(`SELECT * FROM users WHERE login = ?`, [login], (err, user) => {
        if (user) {
            if (user.password === password) res.json({ success: true, message: 'С возвращением!', user });
            else res.json({ success: false, message: 'Неверный пароль' });
        } else {
            db.run(`INSERT INTO users (login, password) VALUES (?, ?)`, [login, password], function() {
                res.json({ success: true, message: 'Новое имя в летописи!', user: { id: this.lastID, login, avatar: 'default.png', total_xp: 0, current_level: 1 } });
            });
        }
    });
});

app.get('/api/progress/:userId', (req, res) => {
    db.all(`SELECT route_id, route_name, progress_percent FROM progress WHERE user_id = ?`, [req.params.userId], (err, rows) => res.json(rows || []));
});

app.post('/api/progress', (req, res) => {
    const { userId, routeId } = req.body;
    const safePercent = clampPercent(req.body.percent);
    const routeMeta = findRouteMeta(routeId);
    if (!routeMeta) return res.status(400).json({ success: false, error: 'Некорректный маршрут' });

    const routeName = routeMeta.route.name;
    db.get(`SELECT id, progress_percent, completion_awarded FROM progress WHERE user_id = ? AND route_id = ?`, [userId, routeId], (err, row) => {
        if (err) return res.status(500).json({ success: false, error: err.message });

        const prevPercent = row ? Number(row.progress_percent) || 0 : 0;
        if (safePercent > prevPercent + 40) {
            return res.status(400).json({ success: false, error: 'Подозрительный скачок прогресса' });
        }

        const nextPercent = Math.max(prevPercent, safePercent);
        const deltaPercent = Math.max(0, nextPercent - prevPercent);
        let xpGained = calcRouteXp(deltaPercent, routeMeta.route, routeMeta.themeId);

        const completionAlreadyAwarded = row ? Number(row.completion_awarded) === 1 : false;
        const completionBonus = (!completionAlreadyAwarded && nextPercent === 100) ? Math.round(35 * (THEME_XP_MULTIPLIER[routeMeta.themeId] || 1)) : 0;
        xpGained += completionBonus;

        const persistProgress = row
            ? (cb) => db.run(
                `UPDATE progress SET progress_percent = ?, route_name = ?, completion_awarded = ? WHERE id = ?`,
                [nextPercent, routeName, completionAlreadyAwarded || completionBonus > 0 ? 1 : 0, row.id],
                cb
            )
            : (cb) => db.run(
                `INSERT INTO progress (user_id, route_id, route_name, progress_percent, completion_awarded) VALUES (?, ?, ?, ?, ?)`,
                [userId, routeId, routeName, nextPercent, completionBonus > 0 ? 1 : 0],
                cb
            );

        persistProgress((progressErr) => {
            if (progressErr) return res.status(500).json({ success: false, error: progressErr.message });

            if (xpGained <= 0) return res.json({ success: true, xpGained: 0, percent: nextPercent });

            db.get(`SELECT total_xp FROM users WHERE id = ?`, [userId], (userErr, user) => {
                if (userErr || !user) return res.status(500).json({ success: false, error: 'Пользователь не найден' });

                const currentXp = Number(user.total_xp) || 0;
                const newTotalXp = currentXp + xpGained;
                const newLevel = Math.floor(newTotalXp / XP_PER_LEVEL) + 1;
                db.run(`UPDATE users SET total_xp = ?, current_level = ? WHERE id = ?`, [newTotalXp, newLevel, userId], (updateErr) => {
                    if (updateErr) return res.status(500).json({ success: false, error: updateErr.message });
                    res.json({ success: true, xpGained, percent: nextPercent });
                });
            });
        });
    });
});

app.get('/api/favorites/:userId', (req, res) => {
    db.all(`SELECT * FROM favorites WHERE user_id = ?`, [req.params.userId], (err, rows) => res.json(rows || []));
});

app.post('/api/favorites', (req, res) => {
    const { userId, routeId, pointIndex, pointTitle, pointPanorama } = req.body;
    db.get(`SELECT id FROM favorites WHERE user_id = ? AND route_id = ? AND point_index = ?`, [userId, routeId, pointIndex], (err, row) => {
        if (row) {
            db.run(`DELETE FROM favorites WHERE id = ?`, [row.id]);
            res.json({ success: true, action: 'removed' });
        } else {
            db.run(`INSERT INTO favorites (user_id, route_id, point_index, point_title, point_panorama) VALUES (?, ?, ?, ?, ?)`, [userId, routeId, pointIndex, pointTitle, pointPanorama], () => res.json({ success: true, action: 'added' }));
        }
    });
});

app.post('/api/avatar', (req, res) => {
    db.run(`UPDATE users SET avatar = ? WHERE id = ?`, [req.body.avatar, req.body.userId], () => res.json({ success: true }));
});

app.get('/api/user/:userId', (req, res) => {
    db.get(`SELECT id, login, avatar, total_xp, current_level FROM users WHERE id = ?`, [req.params.userId], (err, user) => {
        if (err) return res.status(500).json({ error: err.message });
        if (user) {
            user.total_xp = Number(user.total_xp) || 0;
            user.current_level = Number(user.current_level) || 1;
        }
        res.json(user);
    });
});

app.patch('/api/user/:userId/login', (req, res) => {
    const userId = Number(req.params.userId);
    const newLogin = String(req.body?.login || '').trim();
    if (!userId) return res.status(400).json({ success: false, message: 'Некорректный пользователь' });
    if (newLogin.length < 3 || newLogin.length > 24) {
        return res.status(400).json({ success: false, message: 'Ник должен быть от 3 до 24 символов' });
    }

    db.get(`SELECT id FROM users WHERE login = ? AND id != ?`, [newLogin, userId], (checkErr, sameLoginUser) => {
        if (checkErr) return res.status(500).json({ success: false, message: checkErr.message });
        if (sameLoginUser) return res.status(409).json({ success: false, message: 'Такой ник уже занят' });

        db.run(`UPDATE users SET login = ? WHERE id = ?`, [newLogin, userId], function(updateErr) {
            if (updateErr) return res.status(500).json({ success: false, message: updateErr.message });
            db.get(`SELECT id, login, avatar, total_xp, current_level FROM users WHERE id = ?`, [userId], (readErr, user) => {
                if (readErr || !user) return res.status(500).json({ success: false, message: 'Не удалось обновить профиль' });
                res.json({ success: true, message: 'Ник обновлён', user });
            });
        });
    });
});

app.listen(PORT, '26.43.197.237', () => console.log(`🚀 Сервер запущен на http://localhost:${PORT}`));