/*
 * PGH-DOC
 * File: src/Layout/Sidebar/SidebarMenuItems.jsx
 * Apa fungsi bagian ini:
 * - File ini mengatur layout shell aplikasi (header/sidebar/footer).
 * Kenapa perlu:
 * - Perlu agar pengalaman pengguna konsisten, flow antar halaman jelas, dan perubahan UI tidak memecah perilaku fitur.
 * Aturan khususnya apa:
 * - Gunakan komponen global tabel/filter/export yang sudah tersedia; hindari duplikasi implementasi per halaman.
 * - Jaga konsistensi style/theme dan perilaku UX lintas unit.
 * - Integrasi data harus mengikuti adapter serverQuery/helper global yang sudah ada.
 */

import React, { Fragment, useContext, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router-dom';
import { Label } from '@pgh/ui-bootstrap';
import { LI, UL, H6 } from '../../AbstractElements';
import { useAuth } from '../../Auth/AuthContext';
import { getPathAccess, isStreamScopedManager } from '../../Auth/accessControl';
import { MENUITEMS } from './Menu';
import CustomizerContext from '../../_helper/Customizer';

const normalizePath = (path = '') => {
  const normalized = String(path)
    .split('?')[0]
    .replace(/\/{2,}/g, '/')
    .replace(/\/+$/, '')
    .toLowerCase();
  return normalized || '/';
};

const isExactPathMatch = (currentPath, targetPath) => {
  if (!targetPath) {
    return false;
  }

  return normalizePath(currentPath) === normalizePath(targetPath);
};

const SidebarMenuItems = ({ sidebartoogle }) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { isMobileViewport, toggleSidebar } = useContext(CustomizerContext);
  const location = useLocation();
  const [expandedMenus, setExpandedMenus] = useState({});

  const currentPath = useMemo(
    () => normalizePath(location.pathname),
    [location.pathname],
  );

  const visibleSections = useMemo(
    () =>
      MENUITEMS
        .filter(
          (section) =>
            !isStreamScopedManager(user) ||
            ['Workspace', 'Stream'].includes(section.menutitle),
        )
        .map((section) => ({
          ...section,
          visibleItems: section.Items.filter((menuItem) => {
            if (menuItem.children?.length) {
              return menuItem.children.some(
                (child) => getPathAccess(user, child.path).allowed,
              );
            }

            if (menuItem.path) {
              return getPathAccess(user, menuItem.path).allowed;
            }

            return true;
          }),
        }))
        .filter((section) => section.visibleItems.length > 0),
    [user],
  );

  useEffect(() => {
    setExpandedMenus((currentExpandedMenus) => {
      const nextExpandedMenus = { ...currentExpandedMenus };

      visibleSections.forEach((section, sectionIndex) => {
        section.visibleItems.forEach((menuItem, menuIndex) => {
          const menuKey = `${sectionIndex}-${menuIndex}-${menuItem.title}`;
          const visibleChildren = (menuItem.children || []).filter((child) =>
            getPathAccess(user, child.path).allowed,
          );
          const hasActiveChild = visibleChildren.some((child) =>
            isExactPathMatch(currentPath, child.path),
          );
          const isDirectMatch = menuItem.path
            ? isExactPathMatch(currentPath, menuItem.path)
            : false;

          if (hasActiveChild || isDirectMatch) {
            nextExpandedMenus[menuKey] = true;
          }
        });
      });

      return nextExpandedMenus;
    });
  }, [currentPath, user, visibleSections]);

  const closeOverlay = () => {
    const overlay = document.getElementById('bg-overlay1');
    if (overlay) {
      overlay.classList.remove('active');
    }
    if (isMobileViewport) {
      toggleSidebar(true);
    }
    document.body.classList.remove('sidebar-mobile-open');
  };

  const toggleMenu = (menuKey, forceOpen = false) => {
    setExpandedMenus((currentExpandedMenus) => ({
      ...currentExpandedMenus,
      [menuKey]: forceOpen ? true : !currentExpandedMenus[menuKey],
    }));
  };

  return (
    <Fragment>
      <UL attrUL={{ className: 'nav-menu custom-scrollbar' }}>
        <LI attrLI={{ className: 'back-btn' }}>
          <div className="mobile-back text-end">
            <span>Back</span>
            <i className="fa fa-angle-right ps-2"></i>
          </div>
        </LI>

        {visibleSections.map((Item, i) => (
          <Fragment key={i}>
            <LI attrLI={{ className: 'sidebar-main-title' }}>
              <div>
                <H6>{t(Item.menutitle)}</H6>
              </div>
            </LI>

            {Item.visibleItems.map((menuItem, index) => {
              const menuKey = `${i}-${index}-${menuItem.title}`;
              const visibleChildren = (menuItem.children || []).filter(
                (child) => getPathAccess(user, child.path).allowed,
              );
              const hasActiveChild = visibleChildren.some((child) =>
                isExactPathMatch(currentPath, child.path),
              );
              const isDirectActive = menuItem.path
                ? isExactPathMatch(currentPath, menuItem.path)
                : false;
              const isExpanded =
                Boolean(expandedMenus[menuKey]) || hasActiveChild || isDirectActive;
              const isMenuActive = isDirectActive || hasActiveChild;

              return (
                <LI attrLI={{ className: 'dropdown' }} key={index}>
                  {menuItem.type === 'sub' && (
                    <Link
                      to={visibleChildren[0]?.path || menuItem.path || process.env.PUBLIC_URL}
                      className={`nav-link menu-title ${isMenuActive ? 'active' : ''}`}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                      }}
                      onClick={(event) => {
                        event.preventDefault();
                        toggleMenu(menuKey);
                      }}
                    >
                      {menuItem.icon && <menuItem.icon />}
                      <span>{t(menuItem.title)}</span>
                      <div className="according-menu">
                        {isExpanded ? (
                          <i className="fa fa-angle-down"></i>
                        ) : (
                          <i className="fa fa-angle-right"></i>
                        )}
                      </div>
                    </Link>
                  )}

                  {menuItem.type === 'link' && (
                    <Link
                      to={menuItem.path}
                      className={`nav-link menu-title ${isDirectActive ? 'active' : ''}`}
                      onClick={closeOverlay}
                    >
                      {menuItem.icon && <menuItem.icon />}
                      <span>{t(menuItem.title)}</span>
                      {menuItem.badge && (
                        <Label className={menuItem.badge}>
                          {menuItem.badgetxt}
                        </Label>
                      )}
                    </Link>
                  )}

                  {menuItem.children && visibleChildren.length > 0 && (
                    <UL
                      attrUL={{
                        className: 'simple-list sidebar-submenu',
                      }}
                    >
                      <UL
                        attrUL={{
                          className: 'nav-submenu menu-content',
                          style: isExpanded
                            ? sidebartoogle
                              ? { opacity: 1, transition: 'opacity 500ms ease-in' }
                              : { display: 'block' }
                            : { display: 'none' },
                        }}
                      >
                        {visibleChildren
                          .filter((child) => child.title !== 'TEST')
                          .map((childrenItem, childIndex) => (
                            <LI key={childIndex}>
                              <Link
                                to={childrenItem.path}
                                className={`${
                                  isExactPathMatch(currentPath, childrenItem.path) ? 'active' : ''
                                }`}
                                onClick={() => {
                                  toggleMenu(menuKey, true);
                                  closeOverlay();
                                }}
                              >
                                {t(childrenItem.title)}
                              </Link>
                            </LI>
                          ))}
                      </UL>
                    </UL>
                  )}
                </LI>
              );
            })}
          </Fragment>
        ))}
      </UL>
    </Fragment>
  );
};

export default SidebarMenuItems;
