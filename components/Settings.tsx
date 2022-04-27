import { Switch } from '@components/settings';
import React from 'react';

export default class Settings extends React.Component {
   render() {
      const { get, set } = (this.props as any).settings;

      return <Switch
         title='Open in Browser'
         description='Whether to open banners and profile pictures in browser'
         checked={get('openInBrowser', false)}
         onChange={v => set('openInBrowser', v)}
      />;
   }
}