import React from 'react';
import { withStyles } from '@mui/styles';
import { ThemeProvider, StyledEngineProvider } from '@mui/material/styles';
import { SnackbarProvider } from 'notistack';

import AppBar from '@mui/material/AppBar';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';

import GenericApp from '@iobroker/adapter-react-v5/GenericApp';
import { I18n, Loader } from '@iobroker/adapter-react-v5';

import TabOptions from './Tabs/Options';
import TabInputs from './Tabs/Inputs';
import TabOutputs from './Tabs/Outputs';
import TabMarker from './Tabs/Marker';
import TabDbs from './Tabs/DBs';

const styles = theme => ({
    root: {},
    tabContent: {
        padding: 10,
        height: 'calc(100% - 64px - 48px - 20px)',
        overflow: 'auto',
    },
    tabContentIFrame: {
        padding: 10,
        height: 'calc(100% - 64px - 48px - 20px - 38px)',
        overflow: 'auto'
    },
    tab: {
        width: '100%',
        minHeight: '100%'
    }
});

const tabs = [
    {
        name: 'general',
        title: 'General',
        component: TabOptions,
    },
    {
        name: 'inputs',
        title: 'Inputs',
        component: TabInputs,
    },
    {
        name: 'outputs',
        title: 'Outputs',
        component: TabOutputs,
    },
    {
        name: 'marker',
        title: 'Marker',
        component: TabMarker,
    },
    {
        name: 'dbs',
        title: 'DBs',
        component: TabDbs,
    },
]

class App extends GenericApp {
    constructor(props) {
        const extendedProps = {...props};
        extendedProps.encryptedFields = ['pass'];

        extendedProps.translations = {
            'en': require('./i18n/en'),
            'de': require('./i18n/de'),
            'ru': require('./i18n/ru'),
            'pt': require('./i18n/pt'),
            'nl': require('./i18n/nl'),
            'fr': require('./i18n/fr'),
            'it': require('./i18n/it'),
            'es': require('./i18n/es'),
            'pl': require('./i18n/pl'),
            'zh-cn': require('./i18n/zh-cn'),
        };

        extendedProps.sentryDSN = window.sentryDSN;

        super(props, extendedProps);
        this.state.moreLoaded = false;
        this.state.rooms = null;
    }

    onConnectionReady() {
        super.onConnectionReady()
        this.socket.getForeignObjects('enum.rooms.*', 'enum')
            .then(rooms =>
                this.setState({ moreLoaded: true, rooms }));
    }

    getSelectedTab() {
        const selectedTab = this.state.selectedTab;
        if (!selectedTab) {
            return 0;
        } else {
            return tabs.findIndex(tab => tab.name === selectedTab);
        }
    }

    render() {
        if (!this.state.loaded || !this.state.moreLoaded) {
            return <StyledEngineProvider injectFirst>
                <ThemeProvider theme={this.state.theme}>
                    <Loader theme={this.state.themeType} />
                </ThemeProvider>
            </StyledEngineProvider>;
        }

        return <StyledEngineProvider injectFirst>
            <ThemeProvider theme={this.state.theme}>
                <SnackbarProvider>
                    <div className="App" style={{background: this.state.theme.palette.background.default, color: this.state.theme.palette.text.primary}}>
                        <AppBar position="static">
                            <Tabs
                                value={this.getSelectedTab()}
                                onChange={(e, index) => this.selectTab(tabs[index].name, index)}
                                variant="scrollable" scrollButtons="auto">
                                {tabs.map(tab => <Tab
                                    label={tab.icon ? <>{tab.icon}{I18n.t(tab.title)}</> : I18n.t(tab.title)}
                                    data-name={tab.name}
                                    key={tab.name}
                                    title={tab.tooltip ? I18n.t(tab.tooltip) : undefined}
                                />)}
                            </Tabs>
                        </AppBar>
                        <div className={this.isIFrame ? this.props.classes.tabContentIFrame : this.props.classes.tabContent}>
                            {tabs.map((tab, index) => {
                                const TabComponent = tab.component;
                                if (this.state.selectedTab) {
                                    if (this.state.selectedTab !== tab.name) {
                                        return null;
                                    }
                                } else {
                                    if (index !== 0) {
                                        return null;
                                    }
                                }
                                return <TabComponent
                                    key={tab.name}
                                    themeType={this.state.themeType}
                                    common={this.common}
                                    socket={this.socket}
                                    native={this.state.native}
                                    onError={text => this.setState({errorText: (text || text === 0) && typeof text !== 'string' ? text.toString() : text})}
                                    onLoad={native => this.onLoadConfig(native)}
                                    instance={this.instance}
                                    adapterName={this.adapterName}
                                    changed={this.state.changed}
                                    onChange={(attr, value, cb) => this.updateNativeValue(attr, value, cb)}
                                    changeNative={value => this.setState({native: value, changed: this.getIsChanged(value)})}
                                    rooms={this.state.rooms}
                                />
                            })}
                            {/*<pre>{JSON.stringify(this.state.native, null, 2)}</pre>*/}
                        </div>
                        {this.renderError()}
                        {this.renderSaveCloseButtons()}
                    </div>
                </SnackbarProvider>
            </ThemeProvider>
        </StyledEngineProvider>;
    }
}

export default withStyles(styles)(App);
