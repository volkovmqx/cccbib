const path = require('path');
const webpack = require('webpack');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = {
  entry: path.resolve(__dirname, './src/index.js'),
  devtool: false,
  module: {
    rules: [
      {
        test: /\.(ts|tsx|js|jsx|mjs)$/,
        // exclude: /node_modules/,
        exclude: /core-js/,
        use: ['babel-loader'],
      },
      {
        test: /\.css$/i,
        use: ['style-loader', 'css-loader'],
      },
      {
        test: /\.s[ac]ss$/i,
        use: [
          // Creates `style` nodes from JS strings
          'style-loader',
          // Translates CSS into CommonJS
          'css-loader',
          // Compiles Sass to CSS
          'sass-loader',
        ],
      },
    ],
  },
  resolve: {
    extensions: ['*', '.js', '.jsx', '.ts', '.tsx', '.mjs'],
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
    port: 3000,
  },
};
