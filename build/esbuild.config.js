// Конфигурация сборщика esbuild
// Отвечает за превращение наших модульных файлов в один main.js для Obsidian

const esbuild = require('esbuild');

// Определяем режим: разработка или продакшн
// Флаг --dev передаётся при запуске: npm run dev
const isDev = process.argv.includes('--dev');

// Базовая конфигурация сборки
const config = {
  // Точка входа — главный файл плагина
  entryPoints: ['src/main.js'],
  
  // Собирать все импорты в один файл (bundle)
  bundle: true,
  
  // Имя выходного файла — именно его Obsidian загружает как плагин
  outfile: 'main.js',
  
  // Формат модулей: CommonJS (требует require/module.exports)
  format: 'cjs',
  
  // Платформа: Node.js (Obsidian работает на Electron)
  platform: 'node',
  
  // Не включать Obsidian API в сборку — он уже есть в среде выполнения
  external: ['obsidian'],
  
  // Генерировать sourcemap в режиме разработки — для удобной отладки
  sourcemap: isDev ? 'inline' : false,
  
  // Минифицировать код только в продакшене (меньше размер, но сложнее читать)
  minify: !isDev,


  resolveExtensions: ['.js', '.json', '.node'],
  
  // Подстановка переменных окружения в код
  define: {
    'process.env.NODE_ENV': isDev ? '"development"' : '"production"'
  }
};

// Если режим разработки — запускаем watch-режим (автосборка при изменении файлов)
// Иначе — просто собираем один раз
if (isDev) {
  esbuild.context(config).then(ctx => {
    console.log('Запущен режим разработки: слежу за изменениями...');
    ctx.watch();
  }).catch(() => process.exit(1));
} else {
  esbuild.build(config).catch(() => process.exit(1));
}