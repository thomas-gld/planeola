import { useContext } from 'react';
import { FeedbackContext } from '../contexts/feedback';

// { notify(message, tone), confirm(message, options) }: the app's own alert() and confirm().
export default function useFeedback() {
  return useContext(FeedbackContext);
}
