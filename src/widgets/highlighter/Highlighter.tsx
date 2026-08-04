import React from 'react';
import hljs from 'highlight.js';
import asciidoc from 'highlight.js/lib/languages/asciidoc';

import github from 'highlight.js/styles/github.css?raw';
import githubdark from 'highlight.js/styles/github-dark.css?raw';


hljs.registerLanguage('asciidoc', asciidoc);

interface HighlighterProps {
  children: React.ReactNode;
  source?: string;
  theme: 'github' | 'github-dark' | string;
}

export class Highlighter extends React.PureComponent<HighlighterProps> {

  private node: HTMLElement | null = null;

  componentDidMount() {
    if (this.node) {
      hljs.highlightElement(this.node);
    }
  }
 
  componentDidUpdate(prevProps: HighlighterProps) {
    if (
      prevProps.children !== this.props.children || 
      prevProps.source !== this.props.source ||
      prevProps.theme !== this.props.theme
    ) {
      this.highlight();
    }
  }

  highlight() {
    if (this.node) {
      this.node.removeAttribute('data-highlighted');

      const rawText = this.props.source || this.node.textContent || '';
      this.node.textContent = rawText;
      hljs.highlightElement(this.node);
    }
  }

  render() {
    const { children, theme, source} = this.props;
    const actualTheme = theme === 'github' ? github : githubdark;

    return (
      <div>
        <style>{actualTheme}</style>
        <pre ref={(el) => { this.node = el; }}>
          <code className="asciidoc">
            {source}
          </code>
        </pre>
      </div>
    );
  }
}

export default Highlighter;
