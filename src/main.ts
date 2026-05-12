import { createApp } from 'vue';
import App from './App.vue';
import { router } from './router';
import { installErrorHandler } from './errorHandler';
import './style.css';

const app = createApp(App);
installErrorHandler(app);
app.use(router);
app.mount('#app');
