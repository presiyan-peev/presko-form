import { createApp } from "vue";
import "./style.css";
import App from "./App.vue";
import AppInput from "./test-components/AppInput.vue";
import AppSubmit from "./test-components/AppSubmit.vue";

const app = createApp(App);

app.component("AppInput", AppInput).component("AppSubmit", AppSubmit);
app.mount("#app");
