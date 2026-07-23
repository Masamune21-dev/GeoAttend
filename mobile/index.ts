import { registerRootComponent } from 'expo';

// PENTING: daftarkan task background tracking SEBELUM app render
import './src/tracking/locationTask';

import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
registerRootComponent(App);
