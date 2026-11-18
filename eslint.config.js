import vue from 'eslint-plugin-vue';

export default [
    { ignores: ['dist/**', 'node_modules/**'] },
    ...vue.configs['flat/recommended'],
    {
        files: ['src/**/*.js', 'src/**/*.vue'],
        languageOptions: {
            globals: {
                cancelAnimationFrame: 'readonly',
                clearInterval: 'readonly',
                clearTimeout: 'readonly',
                console: 'readonly',
                devicePixelRatio: 'readonly',
                document: 'readonly',
                Image: 'readonly',
                requestAnimationFrame: 'readonly',
                ResizeObserver: 'readonly',
                self: 'readonly',
                setTimeout: 'readonly',
                Worker: 'readonly',
                URL: 'readonly',
                window: 'readonly',
                setInterval: 'readonly'
            }
        },
        rules: {
            'no-unused-vars': 'error',
            'no-undef': 'error',
            'vue/multi-word-component-names': 'off'
        }
    }
];
