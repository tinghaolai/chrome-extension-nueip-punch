import Vue from 'vue';
import Popup from './components/Popup.vue';
import ElementUI from 'element-ui'
import 'element-ui/lib/theme-chalk/index.css'

Vue.use(ElementUI);
const app = new Vue({
    el: '#app',
    render: createElement => createElement(Popup)
});
