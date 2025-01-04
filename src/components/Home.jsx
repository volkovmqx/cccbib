import React, { useState, useRef, useEffect } from 'react';
import { GET_RECENT_CONFERENCES } from '../data';
import { Center, Loader, Container, Box } from '@mantine/core';
import { useWindowEvent, useListState } from '@mantine/hooks';
import { useQuery } from '@apollo/client';
import { Preview } from './Preview';
import { Player } from './Player';
import { handleArrowDown, handleArrowUp, handleArrowLeft, handleArrowRight } from '../helpers/helpers';
import { EventCarousel } from './EventCarousel';

import '../styles.css';

export const Home = () => {
  const [playerIsOpen, setPlayerIsOpen] = useState(false)
  const [activeSlice, setActiveSlice] = useState(0)
  const [dataSlice, dataSliceHandlers] = useListState([]);
  const [isLoading, setIsLoading] = useState(false)
  const [activeEvents, setActiveEvents] = useState({ 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 });

  const { loading, error, data, fetchMore } = useQuery(GET_RECENT_CONFERENCES, {
    variables: { offset: 0 },
  });

  useEffect(() => {
    if (!data) return
    if (data.conferencesRecent) {
      if (activeSlice == 0) {
        dataSliceHandlers.setState(data.conferencesRecent)
      } else {
        dataSliceHandlers.setState(data.conferencesRecent.slice(activeSlice, activeSlice + 6))
      }
      setIsLoading(false)
      //setActiveSlice(activeSlice + 1)
    }
  }, [data])

  const eventRefs = useRef([]);
  const eventApis = useRef([]);


  useWindowEvent('keydown', (e) => {
    if (!data) return
    if ((e.key === 'Escape' || e.key === 'Backspace' || e.keyCode == '461') && playerIsOpen) {
      // close the Player
      e.preventDefault()
      setPlayerIsOpen(false)

    } else if (e.key === 'Enter' && !playerIsOpen) {
      // go to the Event page
      setPlayerIsOpen(true)
    } else if (e.key === 'ArrowRight' && !playerIsOpen) {
      handleArrowRight(eventApis, activeEvents, activeSlice, setActiveEvents)
    } else if (e.key === 'ArrowLeft' && !playerIsOpen) {
      handleArrowLeft(eventApis, activeEvents, activeSlice, setActiveEvents)
    } else if (e.key === 'ArrowDown' && !playerIsOpen) {

      handleArrowDown(setActiveSlice, dataSlice, dataSliceHandlers, data, setIsLoading, fetchMore)
    } else if (e.key === 'ArrowUp' && !playerIsOpen) {
      handleArrowUp(setActiveSlice, dataSliceHandlers, data)
    }
  })
  if (loading || dataSlice.length == 0) return <Center h={"100vh"} ><Loader color="gray" type="dots" size="xl" /></Center>;
  if (error) return <p>Error : {error.message}</p>;
  if (playerIsOpen) return <Player event={dataSlice[0].lectures.nodes[activeEvents[activeSlice] || 0]} conferenceTitle={dataSlice[0].title} />
  return (
    <Container fluid>
      <Preview
        event={dataSlice[0].lectures.nodes[activeEvents[activeSlice] || 0]}
        conferenceTitle={dataSlice[0].title}
      />
      <div className="container">
        <div className="embla_vertical">
          <div className="embla__viewport">
            <div className="embla__container embla__container_vertical">
              {dataSlice.map((c, ci) => (
                <div className="embla__slide" key={ci}>
                  <EventCarousel
                    eventRefs={eventRefs}
                    eventApis={eventApis}
                    events={c}
                    activeEvent={activeEvents[ci + activeSlice]}
                    ci={ci}
                    conferenceTitle={c.title}

                  />
                </div>
              ))}
              {isLoading && (
                <div className="embla__slide">
                  <Box className='skeleton'>
                    <div className='loaderContainer'>
                      <Loader color="gray" type="dots" size="xl" />
                    </div>
                  </Box>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Container>
  );
}
