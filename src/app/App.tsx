import { Workspace } from './Workspace.js';
import '../styles/tokens.css';
import '../features/workspace/ui/workspace.css';
import '../shared/ui/asciidoc-content.css';

/** Single-screen application: a file sidebar and one working area. */
const App = () => <Workspace />;

export default App;
