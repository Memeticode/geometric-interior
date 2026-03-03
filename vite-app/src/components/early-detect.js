/**
 * Theme & locale detection — runs before first paint to prevent FOUC.
 * Must be loaded as a synchronous (non-module) script in <head>.
 */
(function () {
    try {
        var stored = localStorage.getItem('geo-self-portrait-theme');
        var pref = stored || 'system';
        var theme;
        if (pref === 'system') {
            theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        } else {
            theme = pref;
        }
        document.documentElement.setAttribute('data-theme', theme);
    } catch (e) { }
    try {
        var S = ['en', 'es'];
        var s = localStorage.getItem('geo-self-portrait-locale');
        if (s && S.indexOf(s) !== -1) {
            document.documentElement.lang = s;
        } else {
            var langs = navigator.languages || [navigator.language || ''];
            for (var i = 0; i < langs.length; i++) {
                var code = langs[i].split('-')[0].toLowerCase();
                if (S.indexOf(code) !== -1) {
                    document.documentElement.lang = code;
                    break;
                }
            }
        }
    } catch (e) { }
})();
