const path = require('path');
const webpack = require('webpack');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = {
  entry: {
    app: [
      'core-js/modules/es.global-this',
      'core-js/stable',
      'regenerator-runtime/runtime',
      './src/index.js'
    ]
  },
  devtool: false,
  module: {
    rules: [
      {
        test: /\.(ts|tsx|js|jsx|mjs)$/,
        exclude: /core-js/,
        use: ['babel-loader'],
      },
      {
        test: /\.css$/i,
        use: [
          'style-loader',
          {
            loader: 'css-loader',
            options: {
              importLoaders: 1
            }
          }
        ],
      },
      {
        test: /\.s[ac]ss$/i,
        use: [
          'style-loader',
          'css-loader',
          'sass-loader',
        ],
      },
    ],
  },
  resolve: {
    extensions: ['.*', '.js', '.jsx', '.ts', '.tsx', '.mjs'],
    modules: [path.resolve(__dirname, 'src'), 'node_modules'],
  },
  output: {
    path: path.resolve(__dirname, './dist'),
    filename: 'bundle.js',
  },
  plugins: [
    new CopyPlugin({
      patterns: [
        { context: 'assets', from: '**/*' },
        { context: 'src', from: 'index.html' },
      ],
    }),
  ],
  devServer: {
    static: path.resolve(__dirname, './dist'),
    port: 3333,
  },
};
