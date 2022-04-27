import { getLazy, getByProps, bulk, filters } from '@webpack';
import { ContextMenu, Modals } from '@webpack/common';
import { findInReactTree, DOM } from '@utilities';
import { Menu, Modal } from '@components';
import Plugin from '@structures/plugin';
import { clipboard } from 'electron';
import { create } from '@patcher';
import React from 'react';

import Settings from './components/Settings';

const [
   Classes,
   ImageModal,
   Banner,
   Banners,
   Members
] = bulk(
   filters.byProps('modal', 'image'),
   filters.byDisplayName('ImageModal', true),
   filters.byDisplayName('UserBanner', false),
   filters.byProps('getUserBannerURL'),
   filters.byProps('getMember')
);

const Patcher = create('picture-link');

export default class extends Plugin {
   promises: { cancelled: boolean; };
   style: any;

   start(): void {
      this.promises = { cancelled: false };
      this.style = DOM.appendStyle('picture-link', require('./style.css'));
      this.patchAvatars();
      this.patchBanners();
   }

   openImage(src, banner = false) {
      Modals.openModal(e =>
         <Modal.ModalRoot className={Classes.modal} size={Modal.ModalSize.DYNAMIC} {...e}>
            <ImageModal
               src={src}
               width={2048}
               height={banner ? 819 : 2048}
               animated={true}
               autoplay={true}
            />
         </Modal.ModalRoot>
      );
   }

   async patchAvatars(): Promise<void> {
      const Header: any = await getLazy(filters.byDisplayName('UserProfileModalHeader', false));
      if (this.promises.cancelled) return;

      // Fetch it here as its lazy loaded right after UserProfileModalHeader
      const Classes = getByProps('customStatusSoloEmoji', 'header');

      const { openContextMenu, closeContextMenu } = ContextMenu;
      Patcher.after(Header, 'default', (_: any, args: any[], res: any) => {
         const avatar = findInReactTree(res, m => m?.props?.className === Classes.avatar);
         const image = args[0].user?.getAvatarURL?.(false, 2048, true)?.replace('.webp', '.png');

         if (avatar && image) {
            avatar.props.onClick = () => {
               if (this.settings.get('openInBrowser', false)) {
                  open(image);
               } else {
                  this.openImage(image);
               }
            };

            avatar.props.onContextMenu = (e) => openContextMenu(e, () =>
               <Menu.Menu onClose={closeContextMenu}>
                  <Menu.MenuItem
                     label='Open Image'
                     id='open-image'
                     action={() => this.openImage(image)}
                  />
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
      const { openContextMenu, closeContextMenu } = ContextMenu;

      Patcher.after(Banner, 'default', (_, args, res) => {
         const [options]: any = args;
         if (options.bannerType !== 1) return;

         const isGuild = options.guildId;
         const handler = findInReactTree(res.props.children, p => p?.onClick);
         const getter = isGuild ? 'getGuildMemberBannerURL' : 'getUserBannerURL';
         const image = Banners[getter]({
            ...options.user,
            ...(isGuild && Members.getMember(isGuild, options.user.id) || {}),
            canAnimate: true,
            guildId: isGuild
         })?.replace(/(?:\?size=\d{3,4})?$/, '?size=2048')?.replace('.webp', '.png');

         if (!handler?.length && image) {
            res.props.onClick = () => {
               if (this.settings.get('openInBrowser', false)) {
                  open(image);
               } else {
                  this.openImage(image, true);
               }
            };

            res.props.onContextMenu = (e) => openContextMenu(e, () =>
               <Menu.Menu onClose={closeContextMenu}>
                  <Menu.MenuItem
                     label='Open Image'
                     id='open-image'
                     action={() => this.openImage(image)}
                  />
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

   getSettingsPanel(): any {
      return Settings;
   }

   stop(): void {
      this.promises.cancelled = true;
      if (this.style) DOM.removeStyle(this.style);
      Patcher.unpatchAll();
   }
};
