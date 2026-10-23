const path = require('path');
const webpack = require('webpack');
const CopyPlugin = require('copy-webpack-plugin');
const { injectBoot } = require('./tools/index-html');
const appInfo = require('./assets/appinfo.json');

module.exports = {
  entry: {
    app: ['./src/index.tsx'],
  },
  target: ['web', 'es2017'],
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
          },
          path.resolve(__dirname, 'tools/min-css-loader.js'),
        ],
      },
      {
        test: /voctocat\.html$/i,
        type: 'asset/source',
      },
      {
        test: /\.woff2$/i,
        type: 'asset/resource',
        generator: { filename: 'fonts/[name].[contenthash:8][ext]' },
      },
    ],
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
    extensions: ['.js', '.jsx', '.ts', '.tsx', '.mjs'],
    modules: [path.resolve(__dirname, 'src'), 'node_modules'],
  },
  output: {
    path: path.resolve(__dirname, './dist'),
    filename: '[name].bundle.js',
    chunkFilename: '[name].chunk.js',
    clean: true,
  },
  optimization: {
    splitChunks: {
      chunks: 'all',
      cacheGroups: {
        // Separate vendor bundle for better caching
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendor',
          chunks: 'initial',
          priority: 10,
        },
      },
    },
  },
  plugins: [
    new webpack.DefinePlugin({
      APP_VERSION: JSON.stringify(appInfo.version),
      APP_ID: JSON.stringify(appInfo.id),
    }),
    new CopyPlugin({
      patterns: [
        { context: 'assets', from: '**/*' },
        { context: 'src/shared/branding/fonts', from: '*.{txt,md}', to: 'fonts' },
        {
          context: 'src',
          from: 'index.html',
          transform: (content) => injectBoot(content.toString()),
        },
      ],
    }),
  ],
  devServer: {
    static: path.resolve(__dirname, './dist'),
    port: 3333,
  },
};
