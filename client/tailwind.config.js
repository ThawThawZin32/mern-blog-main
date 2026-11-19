module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  corePlugins: {
    preflight: false,
  },
  theme: {
    extend: {
      colors: {
        inkline: {
          ink: '#23251f',
          paper: '#f7f6f1',
          green: '#355d45',
        },
      },
    },
  },
  plugins: [],
};
