import { BrowserRouter } from 'react-router-dom';
import AppLayout from './components/AppLayout';
import './App.css';

function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AppLayout />
    </BrowserRouter>
  );
}

export default App;
