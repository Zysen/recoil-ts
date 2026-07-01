import {WidgetScope} from "./widgetscope.ts";
import {MenuActionWidget, MenuButtonWidget, MenuItemWidget, SubMenuWidget} from "./menu.ts";
import {BoolWithExplanation} from "../booleanwithexplain.ts";
import {ScreenAction} from "../actions/screenAction.ts";
import {Widget} from "./widget.ts";

export interface MenuInfo {
    name:string, children: MenuInfo[],
    create?: (scope: WidgetScope) => Widget;
    action?: ScreenAction<any>|null
}
export class MenuStructure {
    private readonly scope_: WidgetScope;
    private readonly menuArr_: MenuInfo[];

    constructor(scope: WidgetScope) {
        this.scope_ = scope;
        this.menuArr_ = [];
    }

    add(menus:string[], screenAction:ScreenAction<any>|null, opt_create?: () => Widget) {

        let curMenus = this.menuArr_;
        for (let i = 0; i < menus.length; i++) {
            let idx = curMenus.findIndex((el)=> {
                return el.name === menus[i];
            });


            let menuStruct : MenuInfo;
            if (idx === -1) {
                menuStruct = {
                    name: menus[i],
                    children: []
                };
                if (opt_create) {
                    menuStruct.create = opt_create;
                }
                curMenus.push(menuStruct);
            } else {
                menuStruct = curMenus[idx];
            }
            if (i + 1 === menus.length) {
                menuStruct.action = screenAction;

            }
            curMenus = menuStruct.children;
        }
    };

    /**
     * @param {!Array<string>} menus
     */
    addSeparator(menus: string[]) {
        let menus1 = [...menus];
        menus1.push('');
        this.add(menus1, null, () => {
            return new MenuSeparatorWidget();
        });
    }

    private create_(menu: MenuButtonWidget<any>, item:MenuInfo): MenuItemWidget {
        if (item.children.length === 0) {
            if (item.create) {
                return item.create(this.scope_);
            }
            let menuItem = new MenuActionWidget(this.scope_);
            menuItem.attachStruct({name: item.name, enabled: true, action: item.action!.createCallback(this.scope_)});

            return menuItem;
        } else {
            // submenu
            let subMenu = new SubMenuWidget(this.scope_);

            let me = this;
            let subitems = [];
            for (let it of item.children) {
                let menuItem = this.create_(menu, it);
                menuItem.getElement().appendChild(subMenu.getElement());
                subitems.push(me.create_(menu, it));
            }
            subMenu.attachStruct({name: item.name, enabled: BoolWithExplanation.TRUE});

            return subMenu;
        }
    }

    create():MenuButtonWidget<any>[] {
        let menuArr = [];

        let me = this;
        for (let i = 0; i < this.menuArr_.length; i++) {
            if (this.menuArr_.hasOwnProperty(i)) {
                let children = this.menuArr_[i].children;

                let menu = new MenuButtonWidget<string>(this.scope_);
                let items = [];

                for (let item of this.menuArr_[i].children) {
                    items.push(me.create_(menu, item));
                }

                menu.attachStruct({name: this.menuArr_[i].name, items: items});
                menuArr.push(menu);
            }
        }
        return menuArr;
    }
}
