import { Theme, ThemeUIStyleObject } from "theme-ui";

const baseColors = {
  black: "#000",
  white: "#fff",
  magenta: "#da357a",
  magentaLight: "#f0cfdc",
  magentaDark: "#a81f58",
  magentaMedium: "#de96b3",
  lightGrey: "#e6e6e6",
  transparent: "transparent"
};

const colors = {
  text: baseColors.black,
  background: baseColors.white,
  primary: baseColors.magenta,
  secondary: baseColors.magentaLight,
  muted: baseColors.lightGrey,

  primaryHover: baseColors.magentaDark,
  secondaryHover: baseColors.magentaMedium,
  transparent: baseColors.transparent
};

const buttonBase: ThemeUIStyleObject = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",

  ":enabled": { cursor: "pointer" }
};

const button: ThemeUIStyleObject = {
  ...buttonBase,
  px: "32px",
  py: "12px",
  color: "white",

  fontWeight: "bold",

  ":disabled": {
    opacity: 0.5
  }
};

const buttonOutline = (color: string, hoverColor: string): ThemeUIStyleObject => ({
  color,
  borderColor: color,
  background: "none",

  ":enabled:hover": {
    color: "background",
    bg: hoverColor,
    borderColor: hoverColor
  }
});

const iconButton: ThemeUIStyleObject = {
  ...buttonBase,

  padding: 0,
  width: "40px",
  height: "40px",

  background: "none",

  ":disabled": {
    color: "text",
    opacity: 0.25
  }
};

const cardHeadingFontSize = 18.7167;

const cardHoverEffects: ThemeUIStyleObject = {
  cursor: "pointer",
  transform: "translateY(-3px)",
  backdropFilter: "blur(30px)",
  boxShadow: "rgb(218 53 122 / 37%) 0px 5px 10px",
  transition: "box-shadow 5ms ease 0s"
};

const cardGapX = [0, 3, 4];
const cardGapY = [3, 3, 4];

const card: ThemeUIStyleObject = {
  position: "relative",
  border: 1,
  boxShadow: [1, null, 2]
};

const infoCard: ThemeUIStyleObject = {
  ...card,

  padding: 3,

  borderColor: "rgba(122,199,240,0.4)",
  background: "linear-gradient(200deg, #d4d9fc, #cae9f9)",

  h2: {
    mb: 2,
    fontSize: cardHeadingFontSize
  }
};

const formBase: ThemeUIStyleObject = {
  display: "block",
  width: "auto",
  flexShrink: 0,
  padding: 2,
  fontSize: 3
};

const formCell: ThemeUIStyleObject = {
  ...formBase,

  bg: "background",
  border: 1,
  borderColor: "muted",
  borderRadius: 0,
  boxShadow: [1, 2]
};

const overlay: ThemeUIStyleObject = {
  position: "absolute",

  left: 0,
  top: 0,
  width: "100%",
  height: "100%"
};

const modalOverlay: ThemeUIStyleObject = {
  position: "fixed",

  left: 0,
  top: 0,
  width: "100vw",
  height: "100vh"
};

const headerGradient: ThemeUIStyleObject = {
  background: `linear-gradient(90deg, ${colors.background}, ${colors.muted})`
};

const theme: Theme = {
  breakpoints: ["48em", "52em", "64em"],

  space: [0, 4, 8, 16, 24, 30, 32, 48, 64, 128, 256, 512],

  fonts: {
    body: [
      "Lato",
      "-apple-system",
      "BlinkMacSystemFont",
      '"Segoe UI"',
      "Roboto",
      '"Helvetica Neue"',
      "sans-serif"
    ].join(", "),
    heading: "Quicksand",
    monospace: "Menlo, monospace"
  },

  fontSizes: [12, 14, 16, 18, 20, 22, 24, 26, 28, 32, 36, 48, 64, 96],

  fontWeights: {
    body: 400,
    heading: 700,

    light: 200,
    medium: 500,
    bold: 700
  },

  lineHeights: {
    body: 1.5,
    heading: 1.25
  },

  colors,

  borders: [0, "1px solid", "2px solid"],

  shadows: ["0", "0px 4px 8px rgba(41, 49, 71, 0.1)", "0px 8px 16px rgba(41, 49, 71, 0.1)"],

  text: {
    heading: {
      fontFamily: "heading",
      fontWeight: "heading",
      lineHeight: "heading"
    },
    normalBold: {
      fontWeight: "bold"
    },
    small: {
      fontSize: 1,
      fontWeight: "bold"
    },
    medium: {
      fontSize: 3,
      fontWeight: "bold"
    },
    large: {
      fontSize: 8,
      fontWeight: "bold"
    },
    xlarge: {
      fontSize: 10,
      fontWeight: "bold"
    }
  },

  images: {
    primary: {
      cursor: "pointer"
    }
  },

  buttons: {
    primary: {
      ...button,

      bg: "primary",
      borderColor: "primary",

      ":enabled:hover": {
        bg: "primaryHover",
        borderColor: "primaryHover"
      }
    },

    outline: {
      ...button,
      ...buttonOutline("primary", "secondary")
    },

    cancel: {
      ...button,
      color: "text",
      bg: "secondary",
      borderColor: "secondary",
      ":enabled:hover": {
        bg: "secondaryHover",
        borderColor: "secondaryHover"
      },
      opacity: 0.9
    },

    icon: {
      ...iconButton,
      color: "primary",
      ":enabled:hover": { color: "accent" }
    },

    dangerIcon: {
      ...iconButton,
      color: "danger",
      ":enabled:hover": { color: "dangerHover" }
    },

    titleIcon: {
      ...iconButton,
      color: "text",
      ":enabled:hover": { color: "success" }
    }
  },

  cards: {
    primary: {
      ...card,
      padding: 0,
      borderColor: "muted",
      bg: "background",
      "> h2": {
        display: "flex",
        alignItems: "center",
        height: "60px",
        borderRadius: "20px 20px 0 0",
        pl: 4,
        py: 2,
        pr: 2
      }
    },
    base: {
      variant: "cards.primary",
      bg: "transparent",
      boxShadow: "0 3px 10px rgba(0, 0, 0, 0.5)",
      borderRadius: "20px",
      width: "97%",
      maxWidth: "100%",
      position: "relative",
      "> h2": {
        variant: "cards.primary.> h2",
        borderBottom: 1,
        borderColor: "muted"
      }
    },

    info: {
      ...infoCard,

      display: ["none", "block"]
    },

    infoPopup: {
      ...infoCard,

      position: "fixed",
      top: 0,
      right: 3,
      left: 3,
      mt: "72px",
      height: "80%",
      overflowY: "scroll"
    },

    collateralCard: {
      variant: "cards.primary",
      bg: "transparent",
      boxShadow: "0 3px 10px rgba(0, 0, 0, 0.5)",
      borderRadius: "20px",
      width: "97%",
      maxWidth: "100%",
      position: "relative",
      "> h2": {
        variant: "cards.base.> h2",
        height: "60px",
      },
      ":hover": {
        ...cardHoverEffects
      }
    },
    StabilityPoolStakingCard: {
      variant: "cards.base",
      border: "none",
      borderRadius: "20px",
      height: "max-content",
      ":hover": {
        ...cardHoverEffects
      }
    },

    tooltip: {
      padding: 2,

      border: 1,
      borderColor: "muted",
      borderRadius: "4px",
      bg: "background",
      boxShadow: 2,

      fontSize: 1,
      color: "text",
      fontWeight: "body",
      zIndex: 1
    }
  },

  forms: {
    label: {
      ...formBase
    },

    unit: {
      ...formCell,

      textAlign: "center",
      bg: "muted"
    },

    input: {
      ...formCell,

      flex: 1
    },

    editor: {}
  },

  layout: {
    app: {
      position: "relative",
      flexWrap: "wrap",
      height: "100vh",
      overflow: "hidden",
      backgroundSize: "cover",
      backgroundRepeat: "no-repeat",
      flexDirection: "column"
    },
    header: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      pl: 5,
      height: "110px",
      borderBottom: 1,
      borderColor: "muted",
      boxShadow: [1, "none"]
    },

    footer: {
      display: "flex",
      alignItems: "center",
      justifyContent: "center",

      mt: cardGapY,
      px: 3,
      minHeight: "72px",

      bg: "muted"
    },

    main: {
      height: "calc(100vh - 110px)",
      width: "100%",
      overflow: "auto",
      "::-webkit-scrollbar": {
        display: "none"
      }
    },

    columns: {
      display: "flex",
      flexWrap: "wrap",
      justifyItems: "center"
    },

    left: {
      pr: cardGapX,
      width: ["100%", "58%"]
    },

    right: {
      width: ["100%", "42%"]
    },

    actions: {
      justifyContent: "flex-end",
      mt: 2,

      button: {
        p: 2,
        minWidth: "64px"
      }
    },

    disabledOverlay: {
      ...overlay,

      bg: "rgba(255, 255, 255, 0.5)"
    },

    modalOverlay: {
      ...modalOverlay,

      bg: "rgba(0, 0, 0, 0.8)",

      display: "flex",
      justifyContent: "center",
      alignItems: "center"
    },

    modal: {
      padding: 3,
      width: ["100%", "40em"]
    },

    infoOverlay: {
      ...modalOverlay,

      display: ["block", "none"],

      bg: "rgba(255, 255, 255, 0.8)"
    },

    infoMessage: {
      display: "flex",
      justifyContent: "center",
      m: 3,
      alignItems: "center",
      minWidth: "128px"
    },

    sideBarOverlay: {
      display: ["none", "flex"],
      border: 1,
      borderColor: "muted",
      height: "100%",
      width: "20vw",
      flexDirection: "column"
    },
    sideBar: {
      display: "flex",
      flexDirection: "column"
    },
    sideBarLogo: {
      display: "flex",
      alignItems: "center",
      pl: 4,
      height: "110px"
    },
    sideBarNav: {
      display: "flex",
      flexDirection: "column",
      pl: 4
    },
    sidenav: {
      display: ["flex", "none"],
      flexDirection: "column",
      p: 0,
      m: 0,
      borderColor: "muted",
      mr: "25vw",
      height: "100%",
      ...headerGradient
    },

    dashboard: {
      flexDirection: "column",
      height: "100%"
    },

    DashboadHeader: {
      height: "170px"
    },

    badge: {
      border: 0,
      borderRadius: 3,
      p: 1,
      px: 2,
      backgroundColor: "muted",
      color: "slate",
      fontSize: 1,
      fontWeight: "body"
    }
  },

  styles: {
    root: {
      fontFamily: "body",
      lineHeight: "body",
      fontWeight: "body",

      height: "100%",

      "#root": {
        height: "100%"
      }
    },

    h1: {
      variant: "text.heading"
    },
    h2: {
      variant: "text.heading"
    },

    a: {
      textDecoration: "none",
      fontWeight: "bold"
    }
  },

  links: {
    nav: {
      py: 2,
      fontWeight: 800,
      fontSize: 2,
      textTransform: "uppercase",
      width: ["100%", "auto"],
      mt: [3, "auto"]
    }
  }
};

export default theme;
