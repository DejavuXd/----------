import '../styles/tokens.css';
import '../styles/base.css';
import '../styles/layout.css';
import '../styles/components.css';
import '../styles/responsive.css';
import '../styles/mobile.css';
import '../styles/motion.css';
import '../styles/technical.css';
import '../styles/legal.css';
import '../styles/cookies.css';
import { setupCookies } from './cookies.js';
import { setupNavigation } from './navigation.js';
import { setupPreloader } from './preloader.js';

setupPreloader();
setupCookies();
setupNavigation();
