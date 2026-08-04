import config from '@iobroker/eslint-config';

export default [
    ...config,
    {
        languageOptions: {
            parserOptions: {
                allowDefaultProject: {
                    allow: ['*.js', '*.mjs'],
                },
                tsconfigRootDir: import.meta.dirname,
            },
        },
    },
    {
        // disable temporary the rule 'jsdoc/require-param' and enable 'jsdoc/require-jsdoc'
        rules: {
            'jsdoc/require-jsdoc': 'off',
            'jsdoc/require-param': 'off',
            'jsdoc/check-param-names': 'off',
        },
    },
    {
        ignores: [
            'build-backend/**/*',
            'admin/**/*',
            'docs/**/*',
            'test/**/*',
            // js-controller scaffold, created by the adapter tests
            'tmp/**/*',
            'src-admin/**/*',
            'tasks.js',
            '**/*.mjs',
        ],
    },
];
