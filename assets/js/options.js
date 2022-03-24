import Vue from 'vue';

import Options from './components/Options.vue';
import infiniteScroll from 'vue-infinite-loading';

Vue.use(infiniteScroll);

const app = new Vue({
    el: '#app',
    render: createElement => createElement(Options)
});
