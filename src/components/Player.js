import React from 'react';
import { TVPlayer } from "react-tv-player";
import { faGlobe, faClockRotateLeft } from "@fortawesome/free-solid-svg-icons";
import { useLocalStorage } from "@mantine/hooks";
import { getVideo } from '../helpers/helpers';

export function Player({ event }) {
    const [language, setLanguage] = useLocalStorage({
        key: 'language',
        defaultValue: 'deu',
    });
    const [recording, foundLanguage] = getVideo(event.videos)

    const customButtons = [
        { action: "skipback", align: "center", faIcon: faClockRotateLeft },
        { action: "playpause", align: "center" },
        { action: "skipforward", align: "center", faIcon: faClockRotateLeft },
        { action: "mute", align: "right" },
        {
            action: "custom",
            align: "left",
            label: "Switch to" + (language === "deu" ? " English" : " German"),
            faIcon: faGlobe,
            onPress: () => {
                setLanguage(language === "deu" ? "eng" : "deu");
            },
        },
    ];

    if (!foundLanguage) {
        // deactivate the language switch button
        customButtons[4].disabled = true;
    }
    if (recording) {
        return (
            <TVPlayer
                url={recording.url}
                title={event.title}
                subTitle={event.description}
                playing={true}
                customButtons={customButtons}
            />
        );
    } else {
        return <div>404</div>;
    }
}
