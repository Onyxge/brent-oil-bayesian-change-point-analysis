import { Admin, Resource, CustomRoutes, Layout, Menu } from 'react-admin';
import { Route } from 'react-router-dom';
import { dataProvider } from './Components/DataProvider';
import { Dashboard } from './Components/Dashboard';
import { EventList } from './Components/EventList';
import ForecastPage from './Components/ForecastPage';
import EventIcon from '@mui/icons-material/Event';
import TimelineIcon from '@mui/icons-material/Timeline';

import PortfolioDashboard from './PortfolioDashboard';

// Custom layout using your menu
const CustomLayout = (props) => (
    <Layout {...props} menu={CustomMenu} />
);


const App = () => (
    <PortfolioDashboard/>
);

export default App;
