import { getLazy, getByProps, getByDisplayName } from '@webpack';
import { contextMenu, React } from '@webpack/common';
import { findInReactTree } from '@utilities';
import Plugin from '@structures/plugin';
import { clipboard } from 'electron';
import { Menu } from '@components';
import { create } from '@patcher';

const Patcher = create('picture-link');

export default class extends Plugin {
   promises: { cancelled: boolean; };

   start(): void {
      this.promises = { cancelled: false };
      this.patchAvatars();
      this.patchBanners();
   }

   async patchAvatars(): Promise<void> {
      const Header: Object = await getLazy(m => m.default?.displayName == 'UserProfileModalHeader');
      if (this.promises.cancelled) return;

      const classes = getByProps('discriminator', 'header');
      const { openContextMenu, closeContextMenu } = contextMenu;

      Patcher.after(Header, 'default', (_, args, res) => {
         const avatar = findInReactTree(res, m => m?.props?.className == classes.avatar);
         const image = args[0].user?.getAvatarURL?.(false, 4096, true)?.replace('.webp', '.png');

         if (avatar && image) {
            avatar.props.onClick = () => open(image);

            avatar.props.onContextMenu = (e) => openContextMenu(e, () =>
               <Menu.Menu onClose={closeContextMenu}>
                  <Menu.MenuItem
                     label='Copy Avatar URL'
                     id='copy-avatar-url'
                     action={() => clipboard.writeText(image)}
                  />
               </Menu.Menu>
            );
         }

         return res;
      });
   }

   async patchBanners(): Promise<void> {
      const Banner = getByDisplayName('UserBanner', { default: false });
      const [Banners, Members] = getByProps(
         ['getUserBannerURL'],
         ['getMember'],
         { bulk: true }
      );

      if (this.promises.cancelled) return;

      const { openContextMenu, closeContextMenu } = contextMenu;

      Patcher.after(Banner, 'default', (_, args, res) => {
         const [options] = args;
         const isGuild = options.guildId;

         const handler = findInReactTree(res.props.children, p => p?.onClick);
         const getter = isGuild ? 'getGuildMemberBannerURL' : 'getUserBannerURL';
         const image = Banners[getter]({
            ...options.user,
            ...(isGuild && Members.getMember(isGuild, options.user.id) || {}),
            canAnimate: true,
            guildId: isGuild
         })?.replace(/(?:\?size=\d{3,4})?$/, '?size=4096')?.replace('.webp', '.png');

         if (!handler?.children && image) {
            res.props.onClick = () => open(image);

            res.props.onContextMenu = (e) => openContextMenu(e, () =>
               <Menu.Menu onClose={closeContextMenu}>
                  <Menu.MenuItem
                     label='Copy Banner URL'
                     id='copy-banner-url'
                     action={() => clipboard.writeText(image)}
                  />
               </Menu.Menu>
            );

            res.props.className = [res.props.className, 'picture-link'].join(' ');
         }

         return res;
      });
   }

   stop(): void {
      this.promises.cancelled = true;
      Patcher.unpatchAll();
   }
};
