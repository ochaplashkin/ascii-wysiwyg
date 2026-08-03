import React from 'react';
import hljs from 'highlight.js';
import asciidoc from 'highlight.js/lib/languages/asciidoc';

import github from 'highlight.js/styles/github.css?raw';
import githubdark from 'highlight.js/styles/github-dark.css?raw';

hljs.registerLanguage('asciidoc', asciidoc);

export class Highlighter extends React.PureComponent {

  componentDidMount() {
    hljs.highlightElement(this.node);
  }

  componentDidUpdate(prevProps) {
    this.node.removeAttribute('data-highlighted');
    hljs.highlightElement(this.node);
  }

  render() {
    let { children, theme } = this.props;
    const actualTheme = theme === 'github' ? github : githubdark;
    return (
        <div>
                <style>{ actualTheme } </style>
                <pre ref={(node) => this.node = node}>
                    <code className="asciidoc">
                    {children}
                    </code>
                </pre>
        </div>
    );
  }
}

export default Highlighter;
