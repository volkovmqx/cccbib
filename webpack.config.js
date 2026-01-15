const path = require('path');
const webpack = require('webpack');
const CopyPlugin = require('copy-webpack-plugin');
// needed to check webpack-bundle
// const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');
const appInfo = require('./assets/appinfo.json');

module.exports = {
  entry: {
    app: [
      // Full polyfills needed for Chrome 68 (webOS 4.0+). Yes don't remove or I run into a black screen and scratch my head for 30min
      'core-js/stable',
      'regenerator-runtime/runtime',
      './src/index.jsx'
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
        { context: 'src', from: 'index.html' },
      ],
    }),
    // ...(process.env.ANALYZE ? [new BundleAnalyzerPlugin()] : []),
  ],
  devServer: {
    static: path.resolve(__dirname, './dist'),
    port: 3334,
    proxy: [
      {
        context: ['/api'],
        target: 'https://api.media.ccc.de',
        pathRewrite: { '^/api': '' },
        changeOrigin: true,
        secure: true,
      },
      {
        context: ['/subtitles'],
        target: 'https://cdn.media.ccc.de',
        pathRewrite: { '^/subtitles': '' },
        changeOrigin: true,
        secure: true,
        followRedirects: true,
        onProxyRes: function(proxyRes, req, res) {
          // Remove CORS headers from the proxied response
          delete proxyRes.headers['access-control-allow-origin'];
          delete proxyRes.headers['access-control-allow-credentials'];
        },
      },
      {
        context: ['/subtitles-static'],
        target: 'https://static.media.ccc.de',
        pathRewrite: { '^/subtitles-static': '' },
        changeOrigin: true,
        secure: true,
        followRedirects: true,
        logLevel: 'debug',
        onProxyReq: function(proxyReq, req, res) {
          console.log('Proxying to:', proxyReq.path);
        },
        onProxyRes: function(proxyRes, req, res) {
          // Remove CORS headers from the proxied response
          delete proxyRes.headers['access-control-allow-origin'];
          delete proxyRes.headers['access-control-allow-credentials'];
        },
      },
    ],
  },
};
