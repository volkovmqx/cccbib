import React, { useEffect } from 'react';
import { useParams } from 'react-router';
import { useQuery } from '@apollo/client';
import { GET_LECTURE } from '../data';
import { TVPlayer } from "react-tv-player";
import { faGlobe } from "@fortawesome/free-solid-svg-icons";
import { useLocalStorage } from "@mantine/hooks";
import { Center, Loader } from "@mantine/core";

export default function Event({}) {
  let params = useParams();
  const [language, setLanguage] = useLocalStorage({
    key: 'language',
    defaultValue: 'deu',
  });

  const { loading, error, data } = useQuery(GET_LECTURE, {
    variables: { id: params.id },
  });
  const customButtons = [
    { action: "skipback", align: "center" },
    { action: "playpause", align: "center" },
    { action: "skipforward", align: "center" },
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


  if (loading) return <Center h={"100vh"} ><Loader color="gray" type="dots" size="xl"  /></Center>;

  if (error) return <p>Error : {error.message}</p>;
 

    let recording = data.lecture.videos.find(
      (s) => (s.language === language && s.mimeType === "video/mp4" && s.url)
    );
    // check if another language is available
    let otherLanguage = language === "deu" ? "eng" : "deu";
    const otherLanguageAvailable = data.lecture.videos.find(
      (s) => (s.language === otherLanguage && s.mimeType === "video/mp4" && s.url)
    );
    if( !otherLanguageAvailable ) {
      // deactivate the language switch button
      customButtons[4].disabled = true;
    }
    // video in language not found, try to find any video
    if (!recording) {
      recording = data.lecture.videos.find(
        (s) => s.mimeType === "video/mp4" && s.url
      );
      // deactivate the language switch button
      customButtons[4].disabled = true;
    }
    if (recording) {
      return (
        <TVPlayer 
        url={recording.url}
        title={data.lecture.title}
        subTitle={data.lecture.description}
        playing={true}
        customButtons={customButtons}
         />
      );
    } else {
      return <div>404</div>;
    }
}
