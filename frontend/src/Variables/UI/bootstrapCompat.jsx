/*
 * PGH-DOC
 * File: src/Variables/UI/bootstrapCompat.js
 * Apa fungsi bagian ini:
 * - Menjadi adapter global komponen UI bootstrap agar import tidak langsung ke vendor.
 * Kenapa perlu:
 * - Menjaga kompatibilitas API reactstrap lama, sambil menjalankan engine UI react-bootstrap yang kompatibel React 19.
 * Aturan khususnya apa:
 * - Semua halaman harus import dari "@pgh/ui-bootstrap", bukan langsung "reactstrap".
 * - API compat harus stabil (isOpen/toggle/target/innerRef/for/activeTab/tabId).
 * - Komponen baru jangan menambah dependency reactstrap lagi.
 */

import React, {
  createContext,
  forwardRef,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  Alert as RbAlert,
  Badge as RbBadge,
  Breadcrumb as RbBreadcrumb,
  Button as RbButton,
  ButtonGroup as RbButtonGroup,
  Card as RbCard,
  Col as RbCol,
  Container as RbContainer,
  Dropdown as RbDropdown,
  Form as RbForm,
  ListGroup as RbListGroup,
  Modal as RbModal,
  Nav as RbNav,
  Overlay as RbOverlay,
  Popover as RbPopover,
  ProgressBar as RbProgressBar,
  Row as RbRow,
  Spinner as RbSpinner,
  Table as RbTable,
  Tooltip as RbTooltip,
} from "react-bootstrap";

const mergeClassNames = (...values) =>
  values
    .flat()
    .filter(Boolean)
    .join(" ")
    .trim();

const assignRef = (targetRef, value) => {
  if (!targetRef) return;
  if (typeof targetRef === "function") {
    targetRef(value);
    return;
  }
  targetRef.current = value;
};

const combineRefs = (...refs) => (value) => {
  refs.forEach((ref) => assignRef(ref, value));
};

const normalizeBootstrapColor = (color) => {
  const token = String(color || "")
    .trim()
    .toLowerCase();

  if (!token) return "";
  if (token.startsWith("outline-")) {
    return token.replace(/^outline-/, "");
  }
  if (token === "transparent") return "";
  return token;
};

const mapColorToVariant = (color, fallback = "primary") => {
  const token = String(color || "")
    .trim()
    .toLowerCase();

  if (!token) return fallback;
  if (token.startsWith("outline-")) return token;
  if (token === "transparent") return "light";
  return token;
};

const mapDropDirection = (direction) => {
  const token = String(direction || "")
    .trim()
    .toLowerCase();

  if (token === "left") return "start";
  if (token === "right") return "end";
  if (token === "up") return "up";
  if (token === "start") return "start";
  if (token === "end") return "end";
  return "down";
};

const resolveTargetElement = (target) => {
  if (typeof document === "undefined") return null;

  if (!target) return null;

  if (typeof target === "function") {
    return target();
  }

  if (typeof target === "string") {
    const byId = document.getElementById(target);
    if (byId) return byId;
    try {
      return document.querySelector(target);
    } catch {
      return null;
    }
  }

  if (target?.current) return target.current;
  return target instanceof HTMLElement ? target : null;
};

const useResolvedTarget = (target) => {
  const [element, setElement] = useState(() => resolveTargetElement(target));

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    let disposed = false;
    const refresh = () => {
      if (disposed) return;
      const next = resolveTargetElement(target);
      setElement((previous) => (previous === next ? previous : next));
    };

    refresh();
    const timer = window.setInterval(refresh, 250);

    return () => {
      disposed = true;
      window.clearInterval(timer);
    };
  }, [target]);

  return element;
};

const buildOverlayId = (prefix, target) => {
  const token = String(target || "overlay")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .slice(0, 64);
  return `${prefix}-${token || "overlay"}`;
};

const DropdownContext = createContext(null);
const TabContext = createContext("");

export const Alert = forwardRef(({ color, className, ...rest }, ref) => (
  <RbAlert
    ref={ref}
    variant={mapColorToVariant(color, "secondary")}
    className={className}
    {...rest}
  />
));

export const Badge = forwardRef(
  ({ color, pill, className, children, ...rest }, ref) => {
    const variant = mapColorToVariant(color, "secondary");
    const transparentClass =
      String(color || "").toLowerCase() === "transparent"
        ? "bg-transparent border-0"
        : "";

    return (
      <RbBadge
        ref={ref}
        bg={variant}
        pill={Boolean(pill)}
        className={mergeClassNames(transparentClass, className)}
        {...rest}
      >
        {children}
      </RbBadge>
    );
  },
);

export const Breadcrumb = RbBreadcrumb;
export const BreadcrumbItem = forwardRef(({ tag, ...rest }, ref) => (
  <RbBreadcrumb.Item ref={ref} as={tag} {...rest} />
));

export const Button = forwardRef(
  ({ color, size, tag, block, className, ...rest }, ref) => {
    const variant = mapColorToVariant(color, "primary");
    const transparentClass =
      String(color || "").toLowerCase() === "transparent"
        ? "bg-transparent border-0"
        : "";

    return (
      <RbButton
        ref={ref}
        as={tag}
        variant={variant}
        size={size === "sm" || size === "lg" ? size : undefined}
        className={mergeClassNames(block ? "w-100" : "", transparentClass, className)}
        {...rest}
      />
    );
  },
);

export const ButtonGroup = RbButtonGroup;

export const Card = RbCard;
export const CardBody = RbCard.Body;
export const CardFooter = RbCard.Footer;
export const CardHeader = RbCard.Header;
export const CardText = RbCard.Text;
export const CardTitle = forwardRef(({ tag, ...rest }, ref) => (
  <RbCard.Title ref={ref} as={tag} {...rest} />
));

export const Col = RbCol;
export const Container = RbContainer;
export const Row = RbRow;

export const ListGroup = RbListGroup;
export const ListGroupItem = RbListGroup.Item;

export const Spinner = forwardRef(({ color, ...rest }, ref) => (
  <RbSpinner ref={ref} variant={mapColorToVariant(color, "primary")} {...rest} />
));

export const Table = forwardRef(
  ({ dark, color, className, ...rest }, ref) => {
    const variant = dark ? "dark" : mapColorToVariant(color, "");
    return (
      <RbTable ref={ref} variant={variant || undefined} className={className} {...rest} />
    );
  },
);

export const Form = forwardRef(({ tag: Tag = "form", ...rest }, ref) => (
  <Tag ref={ref} {...rest} />
));

export const FormGroup = forwardRef(
  ({ row, check, inline, tag: Tag = "div", className, ...rest }, ref) => (
    <Tag
      ref={ref}
      className={mergeClassNames(
        "form-group",
        row ? "row" : "",
        check ? "form-check" : "",
        inline ? "form-check-inline" : "",
        className,
      )}
      {...rest}
    />
  ),
);

export const Label = forwardRef(
  ({ for: forProp, htmlFor, check, className, ...rest }, ref) => (
    <label
      ref={ref}
      htmlFor={htmlFor || forProp}
      className={mergeClassNames(check ? "form-check-label" : "", className)}
      {...rest}
    />
  ),
);

export const Input = forwardRef((props, ref) => {
  const {
    type = "text",
    tag,
    className,
    innerRef,
    invalid,
    valid,
    children,
    ...rest
  } = props;

  const mergedRef = combineRefs(ref, innerRef);
  const normalizedType = String(type || "text").toLowerCase();
  const inputTag = String(tag || "")
    .trim()
    .toLowerCase();

  const resolvedTag =
    inputTag || (normalizedType === "textarea" ? "textarea" : normalizedType === "select" ? "select" : "input");

  const baseClass =
    resolvedTag === "select"
      ? "form-select"
      : resolvedTag === "textarea"
        ? "form-control"
        : normalizedType === "checkbox" || normalizedType === "radio"
          ? "form-check-input"
          : normalizedType === "range"
            ? "form-range"
            : normalizedType === "color"
              ? "form-control form-control-color"
              : "form-control";

  const resolvedClassName = mergeClassNames(
    baseClass,
    invalid ? "is-invalid" : "",
    valid ? "is-valid" : "",
    className,
  );

  if (resolvedTag === "select") {
    return (
      <select ref={mergedRef} className={resolvedClassName} {...rest}>
        {children}
      </select>
    );
  }

  if (resolvedTag === "textarea") {
    return (
      <textarea ref={mergedRef} className={resolvedClassName} {...rest}>
        {children}
      </textarea>
    );
  }

  return (
    <input ref={mergedRef} type={normalizedType} className={resolvedClassName} {...rest} />
  );
});

export const Modal = forwardRef(
  ({ isOpen, toggle, fade = true, children, zIndex, style, ...rest }, ref) => (
    <RbModal
      ref={ref}
      show={Boolean(isOpen)}
      onHide={toggle}
      animation={fade !== false}
      style={
        zIndex !== undefined
          ? { ...(style || {}), zIndex }
          : style
      }
      {...rest}
    >
      {children}
    </RbModal>
  ),
);

export const ModalHeader = forwardRef(
  ({ toggle, closeButton, tag, className, children, ...rest }, ref) => (
    <RbModal.Header
      ref={ref}
      as={tag}
      closeButton={Boolean(toggle) || Boolean(closeButton)}
      className={className}
      {...rest}
    >
      {children}
    </RbModal.Header>
  ),
);

export const ModalBody = RbModal.Body;
export const ModalFooter = RbModal.Footer;

export const Dropdown = ({
  isOpen,
  toggle,
  direction,
  children,
  onToggle,
  ...rest
}) => {
  const [internalOpen, setInternalOpen] = useState(false);
  const controlled = typeof isOpen === "boolean";
  const show = controlled ? isOpen : internalOpen;

  const handleToggle = (nextShow, event, metadata) => {
    if (controlled) {
      if (typeof toggle === "function") {
        toggle(event, metadata);
      }
    } else {
      setInternalOpen(Boolean(nextShow));
    }

    if (typeof onToggle === "function") {
      onToggle(nextShow, event, metadata);
    }
  };

  const contextValue = useMemo(
    () => ({
      controlled,
      show,
      toggle,
      setInternalOpen,
    }),
    [controlled, show, toggle],
  );

  return (
    <DropdownContext.Provider value={contextValue}>
      <RbDropdown
        show={Boolean(show)}
        onToggle={handleToggle}
        drop={mapDropDirection(direction)}
        {...rest}
      >
        {children}
      </RbDropdown>
    </DropdownContext.Provider>
  );
};

export const DropdownToggle = forwardRef(
  (
    {
      color,
      caret = true,
      tag,
      className,
      onClick,
      children,
      ...rest
    },
    ref,
  ) => {
    const context = useContext(DropdownContext);
    const variant = mapColorToVariant(color, "secondary");
    const transparentClass =
      String(color || "").toLowerCase() === "transparent"
        ? "bg-transparent border-0"
        : "";

    const handleClick = (event) => {
      if (typeof onClick === "function") {
        onClick(event);
      }

      if (context?.controlled && typeof context?.toggle === "function") {
        context.toggle(event);
      }
    };

    return (
      <RbDropdown.Toggle
        ref={ref}
        as={tag}
        variant={variant}
        className={mergeClassNames(
          transparentClass,
          caret === false ? "dropdown-toggle-no-caret" : "",
          className,
        )}
        onClick={handleClick}
        {...rest}
      >
        {children}
      </RbDropdown.Toggle>
    );
  },
);

export const DropdownMenu = ({
  right,
  left,
  end,
  container,
  align,
  children,
  ...rest
}) => {
  void container;
  const resolvedAlign = align || (end || right ? "end" : left ? "start" : undefined);
  return (
    <RbDropdown.Menu align={resolvedAlign} {...rest}>
      {children}
    </RbDropdown.Menu>
  );
};

export const DropdownItem = forwardRef(
  (
    {
      tag,
      toggle = true,
      onClick,
      divider,
      header,
      children,
      ...rest
    },
    ref,
  ) => {
    if (divider) {
      return <RbDropdown.Divider />;
    }

    if (header) {
      return <RbDropdown.Header>{children}</RbDropdown.Header>;
    }

    const handleClick = (event) => {
      if (toggle === false) {
        event.preventDefault();
        event.stopPropagation();
      }
      if (typeof onClick === "function") {
        onClick(event);
      }
    };

    return (
      <RbDropdown.Item ref={ref} as={tag} onClick={handleClick} {...rest}>
        {children}
      </RbDropdown.Item>
    );
  },
);

export const UncontrolledDropdown = (props) => <Dropdown {...props} />;

export const Nav = forwardRef(
  ({ tabs, pills, variant, tag, children, ...rest }, ref) => {
    const resolvedVariant = variant || (tabs ? "tabs" : pills ? "pills" : undefined);
    return (
      <RbNav ref={ref} as={tag} variant={resolvedVariant} {...rest}>
        {children}
      </RbNav>
    );
  },
);

export const NavItem = forwardRef(({ tag, ...rest }, ref) => (
  <RbNav.Item ref={ref} as={tag} {...rest} />
));

export const NavLink = forwardRef(
  ({ tag, className, active, href, onClick, children, ...rest }, ref) => {
    const activeFromClass = /\bactive\b/.test(String(className || ""));
    const resolvedActive = Boolean(active || activeFromClass);
    const as = tag || (href ? undefined : "button");

    const handleClick = (event) => {
      if (!href && as === "button") {
        event.preventDefault();
      }
      if (typeof onClick === "function") {
        onClick(event);
      }
    };

    return (
      <RbNav.Link
        ref={ref}
        as={as}
        href={href}
        active={resolvedActive}
        className={className}
        onClick={handleClick}
        type={as === "button" ? "button" : undefined}
        {...rest}
      >
        {children}
      </RbNav.Link>
    );
  },
);

export const Pagination = forwardRef(
  ({ size, className, children, ...rest }, ref) => (
    <ul
      ref={ref}
      className={mergeClassNames(
        "pagination",
        size === "sm" ? "pagination-sm" : "",
        size === "lg" ? "pagination-lg" : "",
        className,
      )}
      {...rest}
    >
      {children}
    </ul>
  ),
);

export const PaginationItem = forwardRef(
  ({ active, disabled, className, children, ...rest }, ref) => (
    <li
      ref={ref}
      className={mergeClassNames(
        "page-item",
        active ? "active" : "",
        disabled ? "disabled" : "",
        className,
      )}
      {...rest}
    >
      {children}
    </li>
  ),
);

export const PaginationLink = forwardRef(
  (
    {
      href,
      onClick,
      className,
      previous,
      next,
      first,
      last,
      children,
      ...rest
    },
    ref,
  ) => {
    const pseudoHref = href === "#javascript" || href === "#";
    const resolvedHref = href || "#";

    let content = children;
    if (content == null) {
      if (first) content = "\u00ab";
      else if (last) content = "\u00bb";
      else if (previous) content = "\u2039";
      else if (next) content = "\u203a";
    }

    const handleClick = (event) => {
      if (!href || pseudoHref) {
        event.preventDefault();
      }
      if (typeof onClick === "function") {
        onClick(event);
      }
    };

    return (
      <a
        ref={ref}
        href={resolvedHref}
        className={mergeClassNames("page-link", className)}
        onClick={handleClick}
        {...rest}
      >
        {content}
      </a>
    );
  },
);

export const Popover = ({
  isOpen,
  target,
  placement = "top",
  toggle,
  trigger,
  style,
  className,
  id,
  children,
  ...rest
}) => {
  void toggle;
  void trigger;
  const targetElement = useResolvedTarget(target);
  const open = Boolean(isOpen && targetElement);

  return (
    <RbOverlay show={open} target={targetElement} placement={placement}>
      {(overlayProps) => (
        <RbPopover
          id={id || buildOverlayId("popover", target)}
          className={className}
          style={style}
          {...overlayProps}
          {...rest}
        >
          {children}
        </RbPopover>
      )}
    </RbOverlay>
  );
};

export const PopoverHeader = ({ children, ...rest }) => (
  <RbPopover.Header {...rest}>{children}</RbPopover.Header>
);

export const PopoverBody = ({ children, ...rest }) => (
  <RbPopover.Body {...rest}>{children}</RbPopover.Body>
);

export const Tooltip = ({
  isOpen,
  target,
  placement = "top",
  toggle,
  trigger,
  style,
  className,
  id,
  children,
  ...rest
}) => {
  void toggle;
  void trigger;
  const targetElement = useResolvedTarget(target);
  const open = Boolean(isOpen && targetElement);

  return (
    <RbOverlay show={open} target={targetElement} placement={placement}>
      {(overlayProps) => (
        <RbTooltip
          id={id || buildOverlayId("tooltip", target)}
          className={className}
          style={style}
          {...overlayProps}
          {...rest}
        >
          {children}
        </RbTooltip>
      )}
    </RbOverlay>
  );
};

export const UncontrolledTooltip = ({
  target,
  placement = "top",
  children,
  ...rest
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const targetElement = useResolvedTarget(target);

  useEffect(() => {
    if (!targetElement) return undefined;

    const open = () => setIsOpen(true);
    const close = () => setIsOpen(false);

    targetElement.addEventListener("mouseenter", open);
    targetElement.addEventListener("mouseleave", close);
    targetElement.addEventListener("focus", open);
    targetElement.addEventListener("blur", close);

    return () => {
      targetElement.removeEventListener("mouseenter", open);
      targetElement.removeEventListener("mouseleave", close);
      targetElement.removeEventListener("focus", open);
      targetElement.removeEventListener("blur", close);
    };
  }, [targetElement]);

  return (
    <Tooltip isOpen={isOpen} target={target} placement={placement} {...rest}>
      {children}
    </Tooltip>
  );
};

export const Progress = ({
  value = 0,
  min = 0,
  max = 100,
  color,
  striped,
  animated,
  bar,
  multi,
  className,
  children,
  ...rest
}) => {
  const parsedMin = Number.isFinite(Number(min)) ? Number(min) : 0;
  const parsedMax =
    Number.isFinite(Number(max)) && Number(max) > parsedMin
      ? Number(max)
      : 100;
  const parsedValue = Number.isFinite(Number(value)) ? Number(value) : 0;
  const percentage = Math.min(
    100,
    Math.max(0, ((parsedValue - parsedMin) / (parsedMax - parsedMin)) * 100),
  );

  const colorClass = normalizeBootstrapColor(color);
  const barClassName = mergeClassNames(
    "progress-bar",
    colorClass ? `bg-${colorClass}` : "",
    striped ? "progress-bar-striped" : "",
    animated ? "progress-bar-animated" : "",
  );

  if (bar) {
    return (
      <div
        className={barClassName}
        role="progressbar"
        style={{ width: `${percentage}%` }}
        aria-valuenow={parsedValue}
        aria-valuemin={parsedMin}
        aria-valuemax={parsedMax}
        {...rest}
      >
        {children}
      </div>
    );
  }

  if (multi) {
    return (
      <div className={mergeClassNames("progress", className)} {...rest}>
        {children}
      </div>
    );
  }

  return (
    <div className={mergeClassNames("progress", className)} {...rest}>
      <RbProgressBar
        now={parsedValue}
        min={parsedMin}
        max={parsedMax}
        striped={Boolean(striped)}
        animated={Boolean(animated)}
        variant={colorClass || undefined}
        label={children}
      />
    </div>
  );
};

export const Media = forwardRef(({ body, tag: Tag = "div", className, ...rest }, ref) => (
  <Tag
    ref={ref}
    className={mergeClassNames(
      body ? "media-body flex-grow-1" : "d-flex align-items-start",
      className,
    )}
    {...rest}
  />
));

export const TabContent = ({ activeTab, className, children, ...rest }) => (
  <TabContext.Provider value={activeTab}>
    <div className={mergeClassNames("tab-content", className)} {...rest}>
      {children}
    </div>
  </TabContext.Provider>
);

export const TabPane = ({ tabId, className, children, ...rest }) => {
  const activeTab = useContext(TabContext);
  const isActive = String(activeTab) === String(tabId);

  return (
    <div
      className={mergeClassNames(
        "tab-pane",
        "fade",
        isActive ? "active show" : "",
        className,
      )}
      style={isActive ? undefined : { display: "none" }}
      {...rest}
    >
      {children}
    </div>
  );
};
