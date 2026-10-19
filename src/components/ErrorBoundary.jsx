import React from 'react';
import { t } from '../i18n';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
    this.setState({ error });
  }

  handleReset = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="center errorBoundary">
          <div className="errorBoundary__content">
            <div className="errorBoundary__title">{t('Something went wrong')}</div>
            <div className="errorBoundary__message">
              {t('The application encountered an unexpected error. Please try reloading the page.')}
            </div>
            {this.state.error && (
              <div className="errorBoundary__details">{this.state.error.toString()}</div>
            )}
            <button className="errorBoundary__button" onClick={this.handleReset}>
              {t('Reload Application')}
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
