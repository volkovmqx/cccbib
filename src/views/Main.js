import React, { useState } from 'react';
// Import Swiper React components
import { Swiper, SwiperSlide } from 'swiper/react';
import { GET_RECENT_CONFERENCES } from '../data';
import { Container, Group, Image, Box, Center, Loader, Text } from '@mantine/core';
import { useWindowEvent, useListState,  } from '@mantine/hooks';
import { ItemCard } from '../components/ItemCard';
import { useQuery } from '@apollo/client';
import { useNavigate } from "react-router-dom";


// Import Swiper styles
import 'swiper/css';


import '../styles.css';


export default function App() {
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [initialLoaded, setInitialLoaded] = useState(false);
  const navigate = useNavigate();
  const [activeLecture, setActiveLecture] = useState(0);
  const [activeConference, setActiveConference] = useState(0);
  const { loading, error, data, fetchMore } = useQuery(GET_RECENT_CONFERENCES, {
    variables: { offset: 0, first: 3 },
  });

  const [conferencesSliderRef, setConferencesSliderRef] = useState(null);
  const [events, eventHandlers] = useListState([]);


  useWindowEvent('keydown', (e) => {
    if (!data) return
    if (e.key === 'Enter') {
      // go to the Event page
      navigate(`/event/${data.conferencesRecent[activeConference].lectures.nodes[activeLecture].guid}`)

    } else if (e.key === 'ArrowRight') {
      if (data.conferencesRecent[activeConference].lectures.nodes[activeLecture + 1]) {
        setActiveLecture(activeLecture + 1)
        events[activeConference].slideNext()
      }
    } else if (e.key === 'ArrowLeft') {
      if (data.conferencesRecent[activeConference].lectures.nodes[activeLecture - 1]) {
        setActiveLecture(activeLecture - 1)
        events[activeConference].slidePrev()

      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      // load more if there is no more data
      if (!data.conferencesRecent[activeConference + 2]) { 
        setIsLoadingMore(true)
        fetchMore({
          variables: {
            offset: data.conferencesRecent.length,
          }
        }).then(() => {
          setIsLoadingMore(false)
        });
      }
      else if (data.conferencesRecent[activeConference + 1] && events[activeConference + 1]) {
        setActiveLecture(0)
        setActiveConference(activeConference + 1)
        events[activeConference].slideTo(0, 0)
        conferencesSliderRef.slideNext()
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (data.conferencesRecent[activeConference - 1] && events[activeConference - 1]) {
        setActiveLecture(0)
        setActiveConference(activeConference - 1)
        events[activeConference].slideTo(0, 0)
        conferencesSliderRef.slidePrev()
      }
    }
  })
  console.log(loading)
  if (loading) return <Center h={"100vh"} ><Loader color="gray" type="dots" size="xl"  /></Center>;
  if (error) return <p>Error : {error.message}</p>;
  return (
    <Container fluid h={"100vh"}>
      <h1>CCCBIB {isLoadingMore && <Loader color="gray" /> }</h1>
      <Swiper
        direction={'vertical'}
        slidesPerView={"auto"}
        ref={conferencesSliderRef}
        onSwiper={setConferencesSliderRef}
        onSlidesLengthChange={() => {
            if(initialLoaded) {
              setActiveLecture(0)
              setActiveConference(activeConference + 1)
              events[activeConference].slideTo(0, 0)
              conferencesSliderRef.slideNext()
            }
            else {
              setInitialLoaded(true)
            }
          }
        }
      >
        {data.conferencesRecent.map((c, ci) => (
          <SwiperSlide key={c.id} className='conference'>
            <Group wrap="nowrap" spacing="xs">
              <Box w={300} p="xs">
                <Image
                  radius="md"
                  maw={300}
                  src={c.logoUrl}
                />
                <Text ta="center">{c.title}</Text>
              </Box>
              <Swiper
                slidesPerView={"auto"}
                onSwiper={(el) => eventHandlers.insert(ci, el)}
                
                >
                {c.lectures.nodes.map((l, li) => (
                  <SwiperSlide key={l.guid} className='swiper-event-slide'>
                    <ItemCard
                      active={activeLecture === li && activeConference === ci}
                      title={l.title}
                      image={l.images.posterUrl}
                      persons={l.persons}
                      duration={l.duration}
                      viewCount={l.viewCount}
                      guid={l.guid}
                    />
                  </SwiperSlide>
                ))}
              </Swiper>
            </Group>
          </SwiperSlide>
        ))}
      </Swiper>
    </Container>
  );
}
