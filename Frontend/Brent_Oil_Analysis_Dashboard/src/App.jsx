import { Admin, Resource } from 'react-admin';
import { dataProvider } from './Components/DataProvider';
import { Dashboard } from './Components/Dashboard'; // Import your new fancy dashboard
import { EventList } from './Components/EventList'; // Assuming you moved the list code here
import EventIcon from '@mui/icons-material/Event';

const App = () => (
    <Admin dashboard={Dashboard} dataProvider={dataProvider}>
        <Resource name="events" list={EventList} icon={EventIcon} />
    </Admin>
);

export default App;