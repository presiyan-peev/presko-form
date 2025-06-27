import { setup, app } from '@storybook/vue3';
import { h } from 'vue';

// Import your PreskoForm and story components
import PreskoForm from '../src/components/PreskoForm.vue';
import StoryInput from '../src/stories/components/StoryInput.vue';
import StorySelect from '../src/stories/components/StorySelect.vue';
import StoryCheckbox from '../src/stories/components/StoryCheckbox.vue';
import StorySubmitButton from '../src/stories/components/StorySubmitButton.vue';
import StoryTextarea from '../src/stories/components/StoryTextarea.vue';

// Global component registration
setup((app) => {
  app.component('PreskoForm', PreskoForm);
  // Registering the stub components with the names PreskoForm expects
  app.component('AppInput', StoryInput); // StoryInput will act as AppInput in stories
  app.component('AppSelect', StorySelect); // StorySelect will act as AppSelect
  app.component('AppCheckbox', StoryCheckbox); // StoryCheckbox will act as AppCheckbox
  app.component('AppTextarea', StoryTextarea); // StoryTextarea will act as AppTextarea
  app.component('AppSubmit', StorySubmitButton); // StorySubmitButton will act as AppSubmit
});


/** @type { import('@storybook/vue3').Preview } */
const preview = {
  parameters: {
    actions: { argTypesRegex: "^on[A-Z].*" }, // Automatically log events starting with "on"
    controls: {
      matchers: {
       color: /(background|color)$/i,
       date: /Date$/i,
      },
    },
  },
  // Add a global decorator to wrap stories if needed, e.g., for global styles or layout
  // decorators: [
  //   (story) => ({
  //     components: { story },
  //     template: '<div style="padding: 20px;"><story /></div>',
  //   }),
  // ],
};

export default preview;